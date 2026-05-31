<#
.SYNOPSIS
    Backs up all Function App settings to Azure Key Vault.

.DESCRIPTION
    Reads every app setting from the target Function App and stores each one
    as a Key Vault secret. Each run creates a new secret version automatically,
    so you can restore from any point in time using Restore-function-settings.ps1.

    Since Function App setting names only use letters, digits, and underscores,
    the only character that needs to be swapped is underscore ( _ -> - ) because
    Key Vault secret names only allow letters, digits, and hyphens.
    The original setting name is always saved in the OriginalKey tag, which is
    what the restore script uses — so the name encoding is just for readability.

    Settings that are already Key Vault references (@Microsoft.KeyVault(...))
    are stored as-is. On restore they go back to the Function App unchanged,
    which is exactly what you want.

.PARAMETER FunctionAppName
    Name of the Azure Function App to back up.

.PARAMETER KeyVaultName
    Name of the Key Vault to write secrets into.
    If it doesn't exist yet, it will be created in the same resource group
    and region as the Function App.

.EXAMPLE
    ./infra/Backup-function-settings.ps1 `
        -FunctionAppName func-thesrilathaarts-dev `
        -KeyVaultName    kv-thesrilathaarts-dev

.NOTES
    Requirements:
      - PowerShell 7+
      - Az.Accounts, Az.Resources, Az.KeyVault modules
      - The following environment variables must be set before running:
          MY_APPREG_CLIENT_ID
          MY_APPREG_CLIENT_SECRET
          MY_APPREG_TENANT_ID
      - The service principal must have:
          Contributor on the Function App's resource group
          Key Vault Secrets Officer on the target Key Vault (if using RBAC),
          OR a Key Vault Access Policy granting Set/Get on secrets
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$FunctionAppName,

    [Parameter(Mandatory = $true)]
    [string]$KeyVaultName
)

$ErrorActionPreference = 'Stop'

# -------------------------------------------------------
# 1. Validate required environment variables up front
#    so we fail clearly instead of with a cryptic auth error
# -------------------------------------------------------
foreach ($envVar in @('MY_APPREG_CLIENT_ID', 'MY_APPREG_CLIENT_SECRET', 'MY_APPREG_TENANT_ID')) {
    if ([string]::IsNullOrEmpty((Get-Item "env:$envVar" -ErrorAction SilentlyContinue).Value)) {
        throw "Required environment variable '$envVar' is not set."
    }
}

# -------------------------------------------------------
# 2. Validate Key Vault name
#    Azure requires: 3-24 chars, letters/digits/hyphens, must start with a letter
# -------------------------------------------------------
if ($KeyVaultName.Length -lt 3 -or $KeyVaultName.Length -gt 24) {
    throw "KeyVaultName '$KeyVaultName' is $($KeyVaultName.Length) characters. Azure requires between 3 and 24."
}
if ($KeyVaultName -notmatch '^[a-zA-Z][a-zA-Z0-9-]{1,22}[a-zA-Z0-9]$') {
    throw "KeyVaultName '$KeyVaultName' is invalid. It must start with a letter, end with a letter or digit, and contain only letters, digits, and hyphens."
}

# -------------------------------------------------------
# 3. Sign in using the service principal
# -------------------------------------------------------
$securePassword = ConvertTo-SecureString $env:MY_APPREG_CLIENT_SECRET -AsPlainText -Force
$credential = New-Object System.Management.Automation.PSCredential ($env:MY_APPREG_CLIENT_ID, $securePassword)

Connect-AzAccount `
    -ServicePrincipal `
    -Tenant    $env:MY_APPREG_TENANT_ID `
    -Credential $credential | Out-Null

$ctx = Get-AzContext
$backupDate = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fff")

Write-Host "==============================================="
Write-Host "Function App Settings Backup"
Write-Host "==============================================="
Write-Host "Function App : $FunctionAppName"
Write-Host "Key Vault    : $KeyVaultName"
Write-Host "Backup Date  : $backupDate"
Write-Host "Signed in as : $($ctx.Account.Id) on $($ctx.Subscription.Name)" -ForegroundColor DarkGray
Write-Host ""

# -------------------------------------------------------
# 4. Find the Function App and get its resource group + location
#    Using Get-AzResource avoids a bug in Az.Functions 4.x where
#    Get-AzFunctionApp throws on null setting keys in unrelated apps
# -------------------------------------------------------
# @() forces the result into an array so .Count always works,
# even when only one item is returned (PowerShell won't wrap a single object automatically)
$faResources = @(Get-AzResource `
        -ResourceType "Microsoft.Web/sites" `
        -Name         $FunctionAppName `
        -ErrorAction  SilentlyContinue)

if ($faResources.Count -eq 0) {
    throw "Function App '$FunctionAppName' not found in subscription '$($ctx.Subscription.Name)'."
}

# Warn if more than one result came back (same name in multiple resource groups)
if ($faResources.Count -gt 1) {
    Write-Warning "Multiple Function Apps named '$FunctionAppName' found. Using the first one in resource group '$($faResources[0].ResourceGroupName)'."
}

$faResource = $faResources[0]

$resourceGroupName = $faResource.ResourceGroupName
$location = $faResource.Location

Write-Host "Resource Group : $resourceGroupName"
Write-Host "Location       : $location"
Write-Host ""

# -------------------------------------------------------
# 5. Create the Key Vault if it doesn't exist yet
#    EnableRbacAuthorization = true so that role assignments
#    (Key Vault Secrets Officer) work correctly.
#    If your org uses Access Policies instead of RBAC, remove
#    that flag and add a Set-AzKeyVaultAccessPolicy call here.
# -------------------------------------------------------
$keyVault = Get-AzKeyVault -VaultName $KeyVaultName -ErrorAction SilentlyContinue

if (-not $keyVault) {
    Write-Host "Key Vault '$KeyVaultName' not found — creating it now..." -ForegroundColor Yellow

    $keyVault = New-AzKeyVault `
        -Name                  $KeyVaultName `
        -ResourceGroupName     $resourceGroupName `
        -Location              $location `
        -Sku                   Standard `
        -EnableRbacAuthorization

    Write-Host "Key Vault created." -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "Key Vault found." -ForegroundColor DarkGray
    Write-Host ""
}

# -------------------------------------------------------
# 6. Read all Function App settings via ARM REST API
#    (Using the REST call directly avoids the Az.Functions 4.x bug)
# -------------------------------------------------------
$subId = $ctx.Subscription.Id
$apiPath = "/subscriptions/$subId/resourceGroups/$resourceGroupName" +
"/providers/Microsoft.Web/sites/$FunctionAppName" +
"/config/appsettings/list?api-version=2022-03-01"

$response = Invoke-AzRestMethod -Method POST -Path $apiPath -Payload '{}'

if ($response.StatusCode -ne 200) {
    throw "Could not read app settings (HTTP $($response.StatusCode)): $($response.Content)"
}

$settingsProperties = ($response.Content | ConvertFrom-Json).properties.PSObject.Properties

if (-not $settingsProperties) {
    Write-Host "No settings found on Function App '$FunctionAppName'. Nothing to back up." -ForegroundColor Yellow
    exit 0
}

$total = @($settingsProperties).Count
Write-Host "Settings found: $total"
Write-Host ""

# -------------------------------------------------------
# 7. Save each setting as a Key Vault secret
# -------------------------------------------------------
$backed = 0
$skipped = 0

foreach ($setting in $settingsProperties) {

    $originalKey = $setting.Name
    $value = $setting.Value

    # Key Vault cannot store empty strings — skip them
    if ([string]::IsNullOrEmpty($value)) {
        Write-Host "  SKIP (empty value) : $originalKey" -ForegroundColor DarkGray
        $skipped++
        continue
    }

    # Build a valid KV secret name:
    #   - Replace underscore with hyphen (the only invalid char in app setting names)
    #   - Prefix with "x-" if the name starts with a digit (KV requires a letter start)
    $secretName = $originalKey -replace '_', '-'
    if ($secretName -match '^\d') {
        $secretName = "x-$secretName"
    }

    Write-Host "  Backing up : $originalKey  ->  $secretName"

    $secureValue = ConvertTo-SecureString -String $value -AsPlainText -Force

    Set-AzKeyVaultSecret `
        -VaultName   $KeyVaultName `
        -Name        $secretName `
        -SecretValue $secureValue `
        -Tag @{
        OriginalKey = $originalKey
        BackupDate  = $backupDate
        SourceApp   = $FunctionAppName
    } `
        -ErrorAction Stop | Out-Null

    $backed++
}

# -------------------------------------------------------
# 8. Done
# -------------------------------------------------------
Write-Host ""
Write-Host "==============================================="
Write-Host "Backup complete!" -ForegroundColor Green
Write-Host "  Stored  : $backed"
Write-Host "  Skipped : $skipped  (empty values)"
Write-Host "  Date key: $backupDate"
Write-Host "==============================================="