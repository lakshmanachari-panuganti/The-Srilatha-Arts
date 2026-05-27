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
        -KeyVaultName    kv-thesrilathaarts-bkp

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
# Get Function App
# ------------------------------------------------------------
$functionApp = Get-AzFunctionApp |
    Where-Object { $_.Name -eq $FunctionAppName }

if (-not $functionApp) {
    throw "Function App '$FunctionAppName' not found."
}

$resourceGroupName = $functionApp.ResourceGroup
$location = $functionApp.Location

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
# Get ALL Function App settings
# ------------------------------------------------------------
$appSettings = Get-AzWebAppApplicationSetting `
    -ResourceGroupName $resourceGroupName `
    -Name              $FunctionAppName

$total = $appSettings.Properties.Count

Write-Host "Settings found: $total"
Write-Host ""

# ------------------------------------------------------------
# Back up each setting as a new Key Vault secret version
# ------------------------------------------------------------
$backed = 0

foreach ($setting in $appSettings.Properties.GetEnumerator()) {

    $originalKey = $setting.Key
    $value = $setting.Value

    # Key Vault secret names allow [A-Za-z0-9-] only; replace everything else
    $secretName = $originalKey -replace '[^A-Za-z0-9-]', '-'

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
Write-Host "Backup completed: $backed / $total settings stored." -ForegroundColor Green
Write-Host "Backup date key : $backupDate"
Write-Host "==============================================="
