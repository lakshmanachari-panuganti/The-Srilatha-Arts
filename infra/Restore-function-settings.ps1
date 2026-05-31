<#
.SYNOPSIS
    Restores Function App application settings from an Azure Key Vault backup.

.DESCRIPTION
    Reads secrets written by Backup-function-settings.ps1, then writes the
    selected backup version's settings back to the Function App.

    Restore behaviour:
      - Uses Update-AzFunctionAppSetting, which MERGES with existing settings.
        Settings present in the live app but absent in the selected backup are
        left unchanged. The diff preview (printed before any change is applied)
        shows exactly what will be added or changed.
      - Triggers a Function App restart — any in-flight requests may be dropped
        depending on the host's graceful-shutdown configuration.
      - Does not modify the Key Vault — read-only against the vault.

.PARAMETER FunctionAppName
    Name of the Azure Function App to restore settings to.

.PARAMETER KeyVaultName
    Name of the Key Vault that holds the backup (written by
    Backup-function-settings.ps1).

.PARAMETER BackupDate
    Optional. The exact backup-date string to restore, e.g.
    "2026-05-27T12:34:56.789". If omitted, the script lists all available
    dates and prompts interactively.

.EXAMPLE
    # Connect first (if not already connected)
    . ./docs/Azure-Connectivity.ps1

    # Interactive — pick a backup from the menu
    ./infra/Restore-function-settings.ps1 `
        -FunctionAppName func-thesrilathaarts-dev `
        -KeyVaultName    kv-thesrilathaarts-bkp

.EXAMPLE
    # Non-interactive — specify backup date directly
    ./infra/Restore-function-settings.ps1 `
        -FunctionAppName func-thesrilathaarts-dev `
        -KeyVaultName    kv-thesrilathaarts-bkp `
        -BackupDate      "2026-05-27T12:34:56.789"

.NOTES
    Requires:
      - PowerShell 7+
      - Az.Accounts, Az.Functions, Az.Websites, Az.KeyVault 4.0+ modules
        (4.0+ is required for -AsPlainText on Get-AzKeyVaultSecret)
      - An active Az session for a principal with:
          Contributor on the Function App's resource group
          Key Vault Secrets User (or higher) on the Key Vault
        Run docs/Azure-Connectivity.ps1 for SP-based login.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$FunctionAppName,

    [Parameter(Mandatory = $true)]
    [string]$KeyVaultName,

    [Parameter(Mandatory = $false)]
    [string]$BackupDate
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
Write-Host "==============================================="
Write-Host "Function App Settings Restore"
Write-Host "==============================================="
Write-Host "Function App : $FunctionAppName"
Write-Host "Key Vault    : $KeyVaultName"
Write-Host "Az Context   : $($ctx.Account.Id) on $($ctx.Subscription.Name)" -ForegroundColor DarkGray
Write-Host ""

# ------------------------------------------------------------
# Get Function App resource group
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

Write-Host "Resource Group : $resourceGroupName"
Write-Host ""

# ------------------------------------------------------------
# Get ALL secret versions from Key Vault
# -IncludeVersions requires -Name, so we iterate per secret name.
# ------------------------------------------------------------
Write-Host "Reading secret versions from Key Vault..." -ForegroundColor DarkGray

$secretList = Get-AzKeyVaultSecret -VaultName $KeyVaultName
if (-not $secretList) {
    throw "No secrets found in Key Vault '$KeyVaultName'."
}

$allSecrets = $secretList | ForEach-Object {
    Get-AzKeyVaultSecret -VaultName $KeyVaultName -Name $_.Name -IncludeVersions
}

# ------------------------------------------------------------
# Build sorted list of available backup dates from version tags
# ------------------------------------------------------------
$backupDates = @(
    $allSecrets |
        Where-Object { $_.Tags -and $_.Tags.ContainsKey("BackupDate") } |
        ForEach-Object { $_.Tags["BackupDate"] } |
        Sort-Object -Unique
)

if ($backupDates.Count -eq 0) {
    throw "No backup versions found in Key Vault '$KeyVaultName'. Did Backup-function-settings.ps1 run against this vault?"
}

# ------------------------------------------------------------
# Resolve target backup date (parameter or interactive menu)
# ------------------------------------------------------------
if ($BackupDate) {

    if ($backupDates -notcontains $BackupDate) {
        Write-Host "Available backup dates:"
        $backupDates | ForEach-Object { Write-Host "  $_" }
        Write-Host ""
        throw "BackupDate '$BackupDate' not found in Key Vault."
    }
    $selectedBackupDate = $BackupDate

} else {

    Write-Host "Available Backup Versions:"
    Write-Host ""
    for ($i = 0; $i -lt $backupDates.Count; $i++) {
        Write-Host "  [$($i + 1)] $($backupDates[$i])"
    }
    Write-Host ""

    $selection = Read-Host "Select backup version number"

    if (
        -not ($selection -match '^\d+$') -or
        [int]$selection -lt 1 -or
        [int]$selection -gt $backupDates.Count
    ) {
        throw "Invalid selection '$selection'."
    }

    $selectedBackupDate = $backupDates[[int]$selection - 1]
}

Write-Host ""
Write-Host "Selected Backup Date: $selectedBackupDate"
Write-Host ""

# ------------------------------------------------------------
# Build app settings dictionary from the selected backup
# ------------------------------------------------------------
$appSettings = @{}

$selectedSecrets = $allSecrets |
    Where-Object {
        $_.Tags -and
        $_.Tags.ContainsKey("BackupDate") -and
        $_.Tags["BackupDate"] -eq $selectedBackupDate
    }

foreach ($secret in $selectedSecrets) {

    $secretName = $secret.Name

    # Retrieve plaintext for this specific version (-AsPlainText requires Az.KeyVault 4.0+)
    $value = Get-AzKeyVaultSecret `
        -VaultName  $KeyVaultName `
        -Name       $secretName `
        -Version    $secret.Version `
        -AsPlainText

    # Use the stored OriginalKey tag (canonical); fall back to reversing the
    # encoding applied by Backup-function-settings.ps1 for tag-less secrets.
    if ($secret.Tags -and $secret.Tags.ContainsKey("OriginalKey")) {
        $originalKey = $secret.Tags["OriginalKey"]
    } else {
        $originalKey = $secretName -replace '^x-', ''   # strip digit-start prefix
        $originalKey = $originalKey -replace '-C-', ':'
        $originalKey = $originalKey -replace '-D-', '.'
        $originalKey = $originalKey -replace '--',  '_'
    }

    $appSettings[$originalKey] = $value
}

if ($appSettings.Count -eq 0) {
    throw "No settings found for backup date '$selectedBackupDate'."
}

# ------------------------------------------------------------
# Diff preview — keys only, values are never printed
# ------------------------------------------------------------
$subId   = (Get-AzContext).Subscription.Id
$apiPath = "/subscriptions/$subId/resourceGroups/$resourceGroupName" +
           "/providers/Microsoft.Web/sites/$FunctionAppName" +
           "/config/appsettings/list?api-version=2022-03-01"

$currentResponse = Invoke-AzRestMethod -Method POST -Path $apiPath -Payload '{}'

if ($currentResponse.StatusCode -ne 200) {
    throw "Failed to read current app settings (HTTP $($currentResponse.StatusCode)): $($currentResponse.Content)"
}

$currentObj = ($currentResponse.Content | ConvertFrom-Json).properties

$adds    = [System.Collections.Generic.List[string]]::new()
$changes = [System.Collections.Generic.List[string]]::new()
$same    = [System.Collections.Generic.List[string]]::new()

foreach ($key in ($appSettings.Keys | Sort-Object)) {
    $cur = $currentObj.PSObject.Properties[$key]
    if ($null -eq $cur) {
        $adds.Add($key)
    } elseif ($cur.Value -ne $appSettings[$key]) {
        $changes.Add($key)
    } else {
        $same.Add($key)
    }
}

$notInBackup = @(
    $currentObj.PSObject.Properties.Name |
        Where-Object { -not $appSettings.ContainsKey($_) } |
        Sort-Object
)

Write-Host "Diff preview (keys only — values are not shown):"
Write-Host ""
foreach ($k in $adds)    { Write-Host "  ADD    $k" -ForegroundColor Green }
foreach ($k in $changes) { Write-Host "  CHANGE $k" -ForegroundColor Yellow }
foreach ($k in $same)    { Write-Host "  SAME   $k" -ForegroundColor DarkGray }

if ($notInBackup.Count -gt 0) {
    Write-Host ""
    Write-Host "  $($notInBackup.Count) live setting(s) not present in this backup — will be left unchanged:" -ForegroundColor Cyan
    foreach ($k in $notInBackup) { Write-Host "    $k" -ForegroundColor DarkGray }
}

Write-Host ""

if ($adds.Count -eq 0 -and $changes.Count -eq 0) {
    Write-Host "No changes to apply — live app already matches this backup." -ForegroundColor Green
    exit 0
}

Write-Host ("Will apply {0} add(s) and {1} change(s). This will restart the Function App." -f $adds.Count, $changes.Count) -ForegroundColor Yellow
Write-Host ""

$confirm = Read-Host "Apply? [y/N]"
if ($confirm -notmatch '^[Yy]$') {
    Write-Host "Aborted." -ForegroundColor Yellow
    exit 0
}

# ------------------------------------------------------------
# Apply settings via ARM REST API
# (Avoids the Az.Functions 4.x GetRuntimeName bug on the response path)
# PUT replaces the full set, so merge backup into current first.
# ------------------------------------------------------------
Write-Host ""
Write-Host "Updating Function App settings..."

$mergedSettings = @{}
$currentObj.PSObject.Properties | ForEach-Object { $mergedSettings[$_.Name] = $_.Value }
foreach ($key in $appSettings.Keys) { $mergedSettings[$key] = $appSettings[$key] }

$putBody = @{ properties = $mergedSettings } | ConvertTo-Json -Depth 3 -Compress

$putPath = "/subscriptions/$subId/resourceGroups/$resourceGroupName" +
           "/providers/Microsoft.Web/sites/$FunctionAppName" +
           "/config/appsettings?api-version=2022-03-01"

$putResponse = Invoke-AzRestMethod -Method PUT -Path $putPath -Payload $putBody

if ($putResponse.StatusCode -notin @(200, 201)) {
    throw "Failed to update app settings (HTTP $($putResponse.StatusCode)): $($putResponse.Content)"
}

Write-Host ""
Write-Host "==============================================="
Write-Host "Restore completed: $($adds.Count + $changes.Count) setting(s) updated." -ForegroundColor Green
Write-Host "==============================================="
