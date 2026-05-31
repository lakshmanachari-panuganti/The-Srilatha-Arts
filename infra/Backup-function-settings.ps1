<#
.SYNOPSIS
    Backs up all Function App settings to Azure Key Vault.

.DESCRIPTION
    Reads every app setting from the target Function App and stores each one
    as a Key Vault secret. Each run creates a new secret version automatically,
    so you can restore from any point in time using Restore-function-settings.ps1.

    Three cases are handled:

      1. Underscore ( _ )
         Azure allows underscores in setting names but KV does not.
         Encoded as a single hyphen:  AZURE_OPENAI_KEY  →  AZURE-OPENAI-KEY

      2. Dot ( . )
         Azure allows dots in setting names but KV does not.
         Encoded as -DOT-:  TEST.DELETE  →  TEST-DOT-DELETE

      3. Empty value
         Azure allows empty values but KV does not.
         Stored as the sentinel string __EMPTY__ so restore can write it back correctly.

    The original setting name is always saved in the OriginalKey tag.
    This is what the restore script uses — so the encoded name is just
    for readability when browsing the vault.

.PARAMETER FunctionAppName
    Name of the Azure Function App to back up.

.PARAMETER KeyVaultName
    Name of the Key Vault to write secrets into.
    If it does not exist yet, it will be created in the same resource group
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
          Contributor on the Function App resource group
          Key Vault Secrets Officer on the target Key Vault
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
    -Tenant     $env:MY_APPREG_TENANT_ID `
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
# 4. Find the Function App
#    @() forces the result into an array so .Count always works
#    even when only one item is returned
# -------------------------------------------------------
$faResources = @(Get-AzResource `
        -ResourceType "Microsoft.Web/sites" `
        -Name         $FunctionAppName `
        -ErrorAction  SilentlyContinue)

if ($faResources.Count -eq 0) {
    throw "Function App '$FunctionAppName' not found in subscription '$($ctx.Subscription.Name)'."
}

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
# 5. Create the Key Vault if it does not exist yet
# -------------------------------------------------------
$keyVault = Get-AzKeyVault -VaultName $KeyVaultName -ErrorAction SilentlyContinue

if (-not $keyVault) {
    Write-Host "Key Vault '$KeyVaultName' not found — creating it now..." -ForegroundColor Yellow

    $keyVault = New-AzKeyVault `
        -Name                    $KeyVaultName `
        -ResourceGroupName       $resourceGroupName `
        -Location                $location `
        -Sku                     Standard `
        -EnableRbacAuthorization

    Write-Host "Key Vault created." -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "Key Vault found." -ForegroundColor DarkGray
    Write-Host ""
}

# -------------------------------------------------------
# 6. Read all Function App settings via ARM REST API
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
Write-Host "Settings found : $total"
Write-Host ""

# -------------------------------------------------------
# 7. Save each setting as a Key Vault secret
#
#    Three special cases handled per setting:
#
#    CASE 1 — Empty value
#      KV cannot store empty strings. We store the sentinel
#      '__EMPTY__' so restore knows to write back an empty string.
#
#    CASE 2 — Dot ( . ) in the name
#      KV secret names do not allow dots.
#      Encoded as -DOT-  e.g.  TEST.DELETE  →  TEST-DOT-DELETE
#
#    CASE 3 — Underscore ( _ ) in the name
#      KV secret names do not allow underscores.
#      Encoded as a single hyphen  e.g.  AZURE_OPENAI_KEY  →  AZURE-OPENAI-KEY
#
#    No collision risk — app setting names can never contain hyphens,
#    so every hyphen in the KV name came from our encoding.
#    The OriginalKey tag is the primary source of truth on restore.
# -------------------------------------------------------
$backed = 0
$empty = 0

foreach ($setting in $settingsProperties) {

    $originalKey = $setting.Name
    $value = $setting.Value

    # CASE 1 — Empty value
    if ([string]::IsNullOrEmpty($value)) {
        Write-Host "  Backing up : $originalKey  ->  (empty — storing as sentinel __EMPTY__)" -ForegroundColor DarkGray
        $value = '__EMPTY__'
        $empty++
    }

    # CASE 2 + 3 — Encode the secret name for Key Vault
    # Dot must be replaced before underscore so -DOT- is written intact
    $secretName = $originalKey -replace '\.', '-DOT-'   # CASE 2 : . → -DOT-
    $secretName = $secretName -replace '_', '-'        # CASE 3 : _ → -

    # KV requires the name to start with a letter — prefix if it starts with a digit
    if ($secretName -match '^\d') { $secretName = "x-$secretName" }

    if (-not [string]::IsNullOrEmpty($setting.Value)) {
        Write-Host "  Backing up : $originalKey  ->  $secretName"
    }

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
Write-Host "  Empty   : $empty  (stored as sentinel __EMPTY__)"
Write-Host "  Date key: $backupDate"
Write-Host "==============================================="