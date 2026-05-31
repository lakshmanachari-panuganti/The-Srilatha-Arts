<#
.SYNOPSIS
    Restores Function App settings from an Azure Key Vault backup.

.DESCRIPTION
    Reads secrets written by Backup-function-settings.ps1 and restores them
    to the target Function App. For each setting in the backup:
      - If the key already exists in the live app  → it is overwritten
      - If the key does not exist in the live app  → it is created
    Keys that exist in the live app but are NOT in the selected backup are
    left completely untouched.

    A diff preview is shown before anything is changed, and you must confirm
    before the script touches the Function App.

.PARAMETER FunctionAppName
    Name of the Azure Function App to restore settings into.

.PARAMETER KeyVaultName
    Name of the Key Vault that holds the backup secrets
    (the one used when running Backup-function-settings.ps1).

.PARAMETER BackupDate
    Optional. The exact backup-date string to restore, e.g.
    "2026-05-31T23:02:08.266". If omitted, the script shows a menu
    of all available backup dates and asks you to pick one.

.EXAMPLE
    # Interactive — pick a backup from the menu
    ./infra/Restore-function-settings.ps1 `
        -FunctionAppName func-thesrilathaarts-dev `
        -KeyVaultName    kv-thesrilathaarts-dev

.EXAMPLE
    # Non-interactive — pass the backup date directly
    ./infra/Restore-function-settings.ps1 `
        -FunctionAppName func-thesrilathaarts-dev `
        -KeyVaultName    kv-thesrilathaarts-dev `
        -BackupDate      "2026-05-31T23:02:08.266"

.NOTES
    Requirements:
      - PowerShell 7+
      - Az.Accounts, Az.Resources, Az.KeyVault (4.0+) modules
        (4.0+ is needed for -AsPlainText on Get-AzKeyVaultSecret)
      - The following environment variables must be set before running:
          MY_APPREG_CLIENT_ID
          MY_APPREG_CLIENT_SECRET
          MY_APPREG_TENANT_ID
      - The service principal must have:
          Contributor on the Function App's resource group
          Key Vault Secrets User (or higher) on the Key Vault
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

# -------------------------------------------------------
# 1. Validate required environment variables up front
# -------------------------------------------------------
foreach ($envVar in @('MY_APPREG_CLIENT_ID', 'MY_APPREG_CLIENT_SECRET', 'MY_APPREG_TENANT_ID')) {
    if ([string]::IsNullOrEmpty((Get-Item "env:$envVar" -ErrorAction SilentlyContinue).Value)) {
        throw "Required environment variable '$envVar' is not set."
    }
}

# -------------------------------------------------------
# 2. Sign in using the service principal
# -------------------------------------------------------
$securePassword = ConvertTo-SecureString $env:MY_APPREG_CLIENT_SECRET -AsPlainText -Force
$credential = New-Object System.Management.Automation.PSCredential ($env:MY_APPREG_CLIENT_ID, $securePassword)

Connect-AzAccount `
    -ServicePrincipal `
    -Tenant     $env:MY_APPREG_TENANT_ID `
    -Credential $credential | Out-Null

$ctx = Get-AzContext

Write-Host "==============================================="
Write-Host "Function App Settings Restore"
Write-Host "==============================================="
Write-Host "Function App : $FunctionAppName"
Write-Host "Key Vault    : $KeyVaultName"
Write-Host "Signed in as : $($ctx.Account.Id) on $($ctx.Subscription.Name)" -ForegroundColor DarkGray
Write-Host ""

# -------------------------------------------------------
# 3. Find the Function App
#    @() forces the result into an array so .Count always works,
#    even when only one item comes back
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

Write-Host "Resource Group : $resourceGroupName"
Write-Host ""

# -------------------------------------------------------
# 4. Make sure the Key Vault exists
# -------------------------------------------------------
$keyVault = Get-AzKeyVault -VaultName $KeyVaultName -ErrorAction SilentlyContinue
if (-not $keyVault) {
    throw "Key Vault '$KeyVaultName' not found. Make sure Backup-function-settings.ps1 has been run first."
}

# -------------------------------------------------------
# 5. Read all secret versions from the Key Vault
#    We list every secret name first, then pull all versions
#    for each one so we can find every available backup date
# -------------------------------------------------------
Write-Host "Reading backup secrets from Key Vault..." -ForegroundColor DarkGray

$secretNames = @(Get-AzKeyVaultSecret -VaultName $KeyVaultName | Select-Object -ExpandProperty Name)

if ($secretNames.Count -eq 0) {
    throw "No secrets found in Key Vault '$KeyVaultName'. Has Backup-function-settings.ps1 been run against this vault?"
}

# Pull all versions for every secret in one pass
$allVersions = $secretNames | ForEach-Object {
    Get-AzKeyVaultSecret -VaultName $KeyVaultName -Name $_ -IncludeVersions
}

# -------------------------------------------------------
# 6. Build the list of available backup dates from the tags
# -------------------------------------------------------
$backupDates = @(
    $allVersions |
        Where-Object { $_.Tags -and $_.Tags.ContainsKey("BackupDate") } |
        ForEach-Object { $_.Tags["BackupDate"] } |
        Sort-Object -Unique
)

if ($backupDates.Count -eq 0) {
    throw "No tagged backup versions found. The secrets in '$KeyVaultName' may not have been created by Backup-function-settings.ps1."
}

# -------------------------------------------------------
# 7. Resolve which backup date to restore
#    Either the caller passed -BackupDate, or we show a menu
# -------------------------------------------------------
if ($BackupDate) {

    if ($backupDates -notcontains $BackupDate) {
        Write-Host "Available backup dates:"
        $backupDates | ForEach-Object { Write-Host "  $_" }
        Write-Host ""
        throw "BackupDate '$BackupDate' was not found in Key Vault '$KeyVaultName'."
    }

    $selectedDate = $BackupDate

} else {

    Write-Host "Available backup versions:"
    Write-Host ""
    for ($i = 0; $i -lt $backupDates.Count; $i++) {
        Write-Host "  [$($i + 1)]  $($backupDates[$i])"
    }
    Write-Host ""

    $selection = Read-Host "Enter the number of the backup to restore"

    if ($selection -notmatch '^\d+$' -or [int]$selection -lt 1 -or [int]$selection -gt $backupDates.Count) {
        throw "Invalid selection '$selection'. Please enter a number between 1 and $($backupDates.Count)."
    }

    $selectedDate = $backupDates[[int]$selection - 1]
}

Write-Host ""
Write-Host "Selected backup : $selectedDate"
Write-Host ""

# -------------------------------------------------------
# 8. Build the settings dictionary from the selected backup
#    The OriginalKey tag is always the source of truth for
#    the real setting name — the KV secret name is just for storage
# -------------------------------------------------------
$backupSettings = @{}

$selectedVersions = $allVersions | Where-Object {
    $_.Tags -and
    $_.Tags.ContainsKey("BackupDate") -and
    $_.Tags["BackupDate"] -eq $selectedDate
}

foreach ($version in $selectedVersions) {

    # Get the plaintext value for this exact secret version
    $value = Get-AzKeyVaultSecret `
        -VaultName  $KeyVaultName `
        -Name       $version.Name `
        -Version    $version.Version `
        -AsPlainText

    # Always use the OriginalKey tag — it holds the exact Function App setting name
    # (e.g. "AZURE_OPENAI_API_KEY") that was encoded into the KV secret name
    if ($version.Tags -and $version.Tags.ContainsKey("OriginalKey")) {
        $originalKey = $version.Tags["OriginalKey"]
    } else {
        # Safety fallback: reverse the underscore encoding from the backup script
        # This should never be needed since our backup always writes the tag
        $originalKey = $version.Name -replace '^x-', '' -replace '-', '_'
        Write-Warning "Secret '$($version.Name)' has no OriginalKey tag — falling back to name decoding: '$originalKey'"
    }

    $backupSettings[$originalKey] = $value
}

if ($backupSettings.Count -eq 0) {
    throw "No settings found for backup date '$selectedDate'. The backup may be empty or corrupted."
}

Write-Host "Settings in this backup : $($backupSettings.Count)"
Write-Host ""

# -------------------------------------------------------
# 9. Read the current live Function App settings
# -------------------------------------------------------
$subId = $ctx.Subscription.Id
$getPath = "/subscriptions/$subId/resourceGroups/$resourceGroupName" +
"/providers/Microsoft.Web/sites/$FunctionAppName" +
"/config/appsettings/list?api-version=2022-03-01"

$getResponse = Invoke-AzRestMethod -Method POST -Path $getPath -Payload '{}'

if ($getResponse.StatusCode -ne 200) {
    throw "Could not read current Function App settings (HTTP $($getResponse.StatusCode)): $($getResponse.Content)"
}

$currentSettings = ($getResponse.Content | ConvertFrom-Json).properties

# -------------------------------------------------------
# 10. Decide what to do with each key and print it live
#     We go through every key in the backup and check the
#     live app right now — no separate diff pass needed.
#     CREATED    = key does not exist in the live app yet
#     OVERWRITE  = key exists but the value is different
#     SAME       = key exists and value is already identical
# -------------------------------------------------------
$toCreate = [System.Collections.Generic.List[string]]::new()
$toOverwrite = [System.Collections.Generic.List[string]]::new()
$same = [System.Collections.Generic.List[string]]::new()

Write-Host "Checking each setting against the live app:"
Write-Host ""

foreach ($key in ($backupSettings.Keys | Sort-Object)) {
    $liveEntry = $currentSettings.PSObject.Properties[$key]

    if ($null -eq $liveEntry) {
        Write-Host "  [CREATE]     $key" -ForegroundColor Green
        $toCreate.Add($key)
    } elseif ($liveEntry.Value -ne $backupSettings[$key]) {
        Write-Host "  [OVERWRITE]  $key" -ForegroundColor Yellow
        $toOverwrite.Add($key)
    } else {
        Write-Host "  [SAME]       $key" -ForegroundColor DarkGray
        $same.Add($key)
    }
}

# Keys in the live app that are not in the backup at all — we never touch these
$untouched = @(
    $currentSettings.PSObject.Properties.Name |
        Where-Object { -not $backupSettings.ContainsKey($_) } |
        Sort-Object
)

if ($untouched.Count -gt 0) {
    Write-Host ""
    foreach ($k in $untouched) {
        Write-Host "  [NOT IN BACKUP - SKIP]  $k" -ForegroundColor Cyan
    }
}

Write-Host ""

# -------------------------------------------------------
# 11. If nothing needs to change, exit early
# -------------------------------------------------------
if ($toCreate.Count -eq 0 -and $toOverwrite.Count -eq 0) {
    Write-Host "Nothing to do — the live app already matches this backup." -ForegroundColor Green
    exit 0
}

Write-Host "Summary : $($toCreate.Count) to CREATE, $($toOverwrite.Count) to OVERWRITE, $($same.Count) already correct, $($untouched.Count) not in backup." -ForegroundColor Yellow
Write-Host "Note    : This will restart the Function App." -ForegroundColor Yellow
Write-Host ""

$confirm = Read-Host "Apply changes? [y/N]"
if ($confirm -notmatch '^[Yy]$') {
    Write-Host "Aborted. No changes were made." -ForegroundColor Yellow
    exit 0
}

# -------------------------------------------------------
# 12. Apply all changes in one ARM REST API call
#     PUT replaces the full settings block, so we merge
#     the backup on top of the current settings first —
#     that way keys not in the backup are preserved.
# -------------------------------------------------------
Write-Host ""
Write-Host "Applying changes to Function App..."

$mergedSettings = @{}
$currentSettings.PSObject.Properties | ForEach-Object {
    $mergedSettings[$_.Name] = $_.Value
}
foreach ($key in $backupSettings.Keys) {
    $mergedSettings[$key] = $backupSettings[$key]
}

$putBody = @{ properties = $mergedSettings } | ConvertTo-Json -Depth 10 -Compress

$putPath = "/subscriptions/$subId/resourceGroups/$resourceGroupName" +
"/providers/Microsoft.Web/sites/$FunctionAppName" +
"/config/appsettings?api-version=2022-03-01"

$putResponse = Invoke-AzRestMethod -Method PUT -Path $putPath -Payload $putBody

if ($putResponse.StatusCode -notin @(200, 201)) {
    throw "Failed to apply settings (HTTP $($putResponse.StatusCode)): $($putResponse.Content)"
}

# -------------------------------------------------------
# 13. Done
# -------------------------------------------------------
Write-Host ""
Write-Host "==============================================="
Write-Host "Restore complete!" -ForegroundColor Green
Write-Host "  Created    : $($toCreate.Count)"
Write-Host "  Overwritten: $($toOverwrite.Count)"
Write-Host "  Same       : $($same.Count)  (untouched)"
Write-Host "  Not in backup : $($untouched.Count)  (untouched)"
Write-Host "  Backup     : $selectedDate"
Write-Host "==============================================="