<#
.SYNOPSIS
    Backs up all Function App application settings to Azure Key Vault.

.DESCRIPTION
    Reads every app setting from the target Function App and stores each one
    as a Key Vault secret with version tags (BackupDate, OriginalKey, SourceApp).
    Key Vault automatically creates a new version on each write, so every run
    produces a snapshot that can be restored independently via
    Restore-function-settings.ps1.

    Key Vault secret names allow only [A-Za-z0-9-]. Any other character in the
    original setting name (underscores, dots, colons, etc.) is replaced with '-'.
    The exact original key is preserved in the OriginalKey tag and is used by
    Restore-function-settings.ps1 to write back the correct name.

    Settings whose value is a Key Vault reference (@Microsoft.KeyVault(...)) are
    stored as the literal reference string, not the resolved secret value. On
    restore the reference lands back on the Function App unchanged, which is the
    correct behaviour.

.PARAMETER FunctionAppName
    Name of the Azure Function App to back up.

.PARAMETER KeyVaultName
    Name of the Key Vault to write secrets into. Created in the same resource
    group and region as the Function App if it does not already exist.

.EXAMPLE
    # Connect first (if not already connected)
    . ./docs/Azure-Connectivity.ps1

    ./infra/Backup-function-settings.ps1 `
        -FunctionAppName func-thesrilathaarts-dev `
        -KeyVaultName    kv-thesrilathaarts-dev

.NOTES
    Requires:
      - PowerShell 7+
      - Az.Accounts, Az.Functions, Az.Websites, Az.KeyVault modules
      - An active Az session for a principal with:
          Contributor on the Function App's resource group
          Key Vault Secrets Officer on the target Key Vault
        Run docs/Azure-Connectivity.ps1 for SP-based login.

    Each run writes a new version of every secret — the number of versions
    accumulates over time. Use the Azure portal or az keyvault secret list to
    prune old versions if needed.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$FunctionAppName,

    [Parameter(Mandatory = $true)]
    [string]$KeyVaultName
)

$ErrorActionPreference = 'Stop'

# ------------------------------------------------------------
# Validate Key Vault name early (Azure enforces 3-24 chars, [a-zA-Z0-9-])
# ------------------------------------------------------------
if ($KeyVaultName.Length -lt 3 -or $KeyVaultName.Length -gt 24) {
    throw "KeyVaultName '$KeyVaultName' is $($KeyVaultName.Length) characters. Azure requires 3–24."
}
if ($KeyVaultName -notmatch '^[a-zA-Z][a-zA-Z0-9-]*[a-zA-Z0-9]$') {
    throw "KeyVaultName '$KeyVaultName' contains invalid characters. Only letters, digits, and hyphens are allowed, and it must start with a letter."
}

# ------------------------------------------------------------
# Verify active Az session
# ------------------------------------------------------------
Disconnect-AzAccount
$securePassword = ConvertTo-SecureString $env:MY_APPREG_CLIENT_SECRET -AsPlainText -Force
$credential = New-Object System.Management.Automation.PSCredential ($env:MY_APPREG_CLIENT_ID, $securePassword)
$con = Connect-AzAccount -ServicePrincipal -Tenant $env:MY_APPREG_TENANT_ID -Credential $credential
$ctx = $con.context
$backupDate = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fff")

Write-Host "==============================================="
Write-Host "Function App Settings Backup"
Write-Host "==============================================="
Write-Host "Function App : $FunctionAppName"
Write-Host "Key Vault    : $KeyVaultName"
Write-Host "Backup Date  : $backupDate"
Write-Host "Az Context   : $($ctx.Account.Id) on $($ctx.Subscription.Name)" -ForegroundColor DarkGray
Write-Host ""

# ------------------------------------------------------------
# Get Function App resource group + location
# Use Get-AzResource instead of Get-AzFunctionApp to avoid a bug in
# Az.Functions 4.x where a subscription-wide scan throws on null app-setting
# keys in unrelated apps.
# ------------------------------------------------------------
$faResource = Get-AzResource `
    -ResourceType "Microsoft.Web/sites" `
    -Name $FunctionAppName `
    -ErrorAction SilentlyContinue

if (-not $faResource) {
    throw "Function App '$FunctionAppName' not found."
}

$resourceGroupName = $faResource.ResourceGroupName
$location = $faResource.Location

Write-Host "Resource Group : $resourceGroupName"
Write-Host "Location       : $location"
Write-Host ""

# ------------------------------------------------------------
# Create Key Vault if it does not exist
# ------------------------------------------------------------
$keyVault = Get-AzKeyVault `
    -VaultName $KeyVaultName `
    -ErrorAction SilentlyContinue

if (-not $keyVault) {

    Write-Host "Key Vault does not exist — creating: $KeyVaultName" -ForegroundColor Yellow

    $keyVault = New-AzKeyVault `
        -Name              $KeyVaultName `
        -ResourceGroupName $resourceGroupName `
        -Location          $location `
        -Sku               Standard

    Write-Host "Key Vault created." -ForegroundColor Green
    Write-Host ""

} else {

    Write-Host "Key Vault exists." -ForegroundColor DarkGray
    Write-Host ""
}

# ------------------------------------------------------------
# Get ALL Function App settings via ARM REST API
# (Avoids a bug in Az.Functions 4.x where Get-AzFunctionAppSetting
# throws on null app-setting keys during internal runtime inspection)
# ------------------------------------------------------------
$subId   = (Get-AzContext).Subscription.Id
$apiPath = "/subscriptions/$subId/resourceGroups/$resourceGroupName" +
           "/providers/Microsoft.Web/sites/$FunctionAppName" +
           "/config/appsettings/list?api-version=2022-03-01"

$response = Invoke-AzRestMethod -Method POST -Path $apiPath -Payload '{}'

if ($response.StatusCode -ne 200) {
    throw "Failed to read app settings (HTTP $($response.StatusCode)): $($response.Content)"
}

$settingsProperties = ($response.Content | ConvertFrom-Json).properties.PSObject.Properties

$total = @($settingsProperties).Count

Write-Host "Settings found: $total"
Write-Host ""

# ------------------------------------------------------------
# Back up each setting as a new Key Vault secret version
# ------------------------------------------------------------
$backed = 0

$skipped = 0

foreach ($setting in $settingsProperties) {

    $originalKey = $setting.Name
    $value       = $setting.Value

    # Key Vault secrets cannot hold empty strings
    if ([string]::IsNullOrEmpty($value)) {
        Write-Host "  SKIP (empty) : $originalKey" -ForegroundColor DarkGray
        $skipped++
        continue
    }

    # Key Vault secret names allow [A-Za-z0-9-] only and must start with a letter.
    # Encode each problematic char with a unique multi-char token so that
    # FOO_BAR, FOO-BAR, FOO.BAR, and FOO:BAR all produce different KV names
    # and the mapping is visually reversible (OriginalKey tag is the real source
    # of truth on restore, but readable names help when browsing the vault):
    #   _  →  --   (underscore  → double hyphen)
    #   .  →  -D-  (dot         → hyphen D hyphen)
    #   :  →  -C-  (colon       → hyphen C hyphen)
    # Any other invalid char falls back to a single hyphen.
    # If the result starts with a digit (KV requires a letter start), prefix x-.
    $secretName = $originalKey -replace '_', '--'
    $secretName = $secretName  -replace '\.', '-D-'
    $secretName = $secretName  -replace ':',  '-C-'
    $secretName = $secretName  -replace '[^A-Za-z0-9-]', '-'
    if ($secretName -match '^\d') { $secretName = "x-$secretName" }

    Write-Host "  $originalKey -> $secretName"

    $secureValue = ConvertTo-SecureString -String $value -AsPlainText -Force

    Set-AzKeyVaultSecret `
        -VaultName   $KeyVaultName `
        -Name        $secretName `
        -SecretValue $secureValue `
        -Tag @{
        OriginalKey = $originalKey
        BackupDate  = $backupDate
        SourceApp   = $FunctionAppName
    } -ErrorAction Stop | Out-Null

    $backed++
}

Write-Host ""
Write-Host "==============================================="
Write-Host "Backup completed: $backed stored, $skipped skipped (empty value)." -ForegroundColor Green
Write-Host "Backup date key : $backupDate"
Write-Host "==============================================="
