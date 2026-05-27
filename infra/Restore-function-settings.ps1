param(
    [Parameter(Mandatory = $true)]
    [string]$FunctionAppName,

    [Parameter(Mandatory = $true)]
    [string]$KeyVaultName
)

# ------------------------------------------------------------
# Prerequisites
# ------------------------------------------------------------
# Install-Module Az -Scope CurrentUser
# Connect-AzAccount
# ------------------------------------------------------------

Write-Host "==============================================="
Write-Host "Function App Settings Restore"
Write-Host "==============================================="
Write-Host "Function App : $FunctionAppName"
Write-Host "Key Vault    : $KeyVaultName"
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

Write-Host "Resource Group : $resourceGroupName"
Write-Host ""

# ------------------------------------------------------------
# Get ALL secrets
# ------------------------------------------------------------
$allSecrets = Get-AzKeyVaultSecret `
    -VaultName $KeyVaultName `
    -IncludeVersions

if (-not $allSecrets) {
    throw "No secrets found in Key Vault."
}

# ------------------------------------------------------------
# Get available backup dates
# ------------------------------------------------------------
$backupDates = $allSecrets |
    Where-Object { $_.Tags.ContainsKey("BackupDate") } |
    Select-Object -ExpandProperty Tags |
    Select-Object -ExpandProperty BackupDate -Unique |
    Sort-Object

if (-not $backupDates) {
    throw "No backup versions found."
}

Write-Host "Available Backup Versions:"
Write-Host ""

for ($i = 0; $i -lt $backupDates.Count; $i++) {
    Write-Host "[$($i + 1)] $($backupDates[$i])"
}

Write-Host ""

# ------------------------------------------------------------
# Choose backup version
# ------------------------------------------------------------
$selection = Read-Host "Select backup version number"

if (
    -not ($selection -match '^\d+$') -or
    [int]$selection -lt 1 -or
    [int]$selection -gt $backupDates.Count
) {
    throw "Invalid selection."
}

$selectedBackupDate = $backupDates[[int]$selection - 1]

Write-Host ""
Write-Host "Selected Backup Date: $selectedBackupDate"
Write-Host ""

# ------------------------------------------------------------
# Build app settings dictionary
# ------------------------------------------------------------
$appSettings = @{}

# Get only secrets matching selected backup date
$selectedSecrets = $allSecrets |
    Where-Object {
        $_.Tags.ContainsKey("BackupDate") -and
        $_.Tags["BackupDate"] -eq $selectedBackupDate
    }

foreach ($secret in $selectedSecrets) {

    $secretName = $secret.Name

    # --------------------------------------------------------
    # Get FULL secret version value
    # --------------------------------------------------------
    $secretVersion = Get-AzKeyVaultSecret `
        -VaultName $KeyVaultName `
        -Name $secretName `
        -Version $secret.Version

    $value = $secretVersion.SecretValueText

    # --------------------------------------------------------
    # Restore original app setting key
    # --------------------------------------------------------
    if ($secret.Tags.ContainsKey("OriginalKey")) {
        $originalKey = $secret.Tags["OriginalKey"]
    } else {
        $originalKey = $secretName.Replace("-", "_")
    }

    Write-Host "Restoring: $originalKey"

    $appSettings[$originalKey] = $value
}

# ------------------------------------------------------------
# Restore Function App Settings
# ------------------------------------------------------------
Write-Host ""
Write-Host "Updating Function App settings..."
Write-Host ""

Update-AzFunctionAppSetting `
    -Name $FunctionAppName `
    -ResourceGroupName $resourceGroupName `
    -AppSetting $appSettings

Write-Host ""
Write-Host "==============================================="
Write-Host "Restore completed successfully."
Write-Host "==============================================="