<#
.SYNOPSIS
    Updates the RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET app settings on
    the matching Function App.

.DESCRIPTION
    Unlike the webhook secret (which we choose ourselves), the Razorpay
    key id + secret are issued by Razorpay and come in matched pairs:
      - test mode -> rzp_test_xxx + matching secret (DEV)
      - live mode -> rzp_live_xxx + matching secret (PRD)

    Rotating either one alone leaves the other side broken, so this
    script writes BOTH in a single 'az functionapp config appsettings set'
    call.

    Existing values are overwritten unconditionally.

.PARAMETER Environment
    Either 'dev' or 'prd'. Picks the correct resource group, Function
    App name, and the expected key prefix (rzp_test_ or rzp_live_).

.PARAMETER KeyId
    The Razorpay Key ID (the 'rzp_test_xxxx' or 'rzp_live_xxxx' string).

.PARAMETER KeySecret
    The Razorpay Key Secret that pairs with the KeyId.

.PARAMETER Force
    Skip the prefix-vs-environment sanity check. Use only when you
    intentionally want to point dev at live keys (or vice versa) for
    a one-off debugging scenario. Without -Force the script refuses
    to put a 'rzp_live_' key on dev or a 'rzp_test_' key on prd.

.EXAMPLE
    # Ensure you are logged in first
    az login

    # Rotate DEV (test) keys
    ./infra/Rotate-RazorpayApiKeys.ps1 -Environment dev `
        -KeyId 'rzp_test_xxxxxxxxxxxxxx' `
        -KeySecret 'xxxxxxxxxxxxxxxxxxxxxxxx'

.EXAMPLE
    # Rotate PRD (live) keys
    ./infra/Rotate-RazorpayApiKeys.ps1 -Environment prd `
        -KeyId 'rzp_live_aBcDeFgHiJkLmN' `
        -KeySecret 'yyyyyyyyyyyyyyyyyyyyyyyy'

.NOTES
    Requires:
      - Azure CLI installed (https://aka.ms/installazurecliwindows)
      - An active az session ('az login') for a principal with Contributor
        or higher on the target Function App's resource group.

    Authoring notes:
      - The KeyId is only safe to print to the console (it's the value
        the browser sees when Razorpay Checkout opens). The KeySecret
        is NEVER printed; the script only logs its length after the
        Function App accepts the write.
      - 'az functionapp config appsettings set' merges with existing
        settings, so no other env vars are disturbed.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('dev', 'prd')]
    [string]$Environment,

    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$KeyId,

    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$KeySecret,

    [Parameter(Mandatory = $false)]
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

# ─── Environment → Azure resource mapping ─────────────────────────────────
$AppSlug = 'thesrilathaarts'
$envMap = @{
    'dev' = @{
        ResourceGroup   = "rg-$AppSlug-dev"
        FunctionAppName = "func-$AppSlug-dev"
        ExpectedPrefix  = 'rzp_test_'
        RazorpayMode    = 'TEST mode'
        KeyVaultName    = "kv-$AppSlug-dev"
    }
    'prd' = @{
        ResourceGroup   = "rg-$AppSlug-prd"
        FunctionAppName = "func-$AppSlug-prd"
        ExpectedPrefix  = 'rzp_live_'
        RazorpayMode    = 'LIVE mode'
        KeyVaultName    = "kv-$AppSlug-prd"
    }
}

$envCfg = $envMap[$Environment]

# ─── Validate inputs BEFORE taking the backup ─────────────────────────────
$trimmedKeyId     = $KeyId.Trim()
$trimmedKeySecret = $KeySecret.Trim()

if ($trimmedKeyId.Length -lt 16) {
    throw "KeyId looks too short ($($trimmedKeyId.Length) chars). Razorpay key ids are usually 20+ characters."
}
if ($trimmedKeySecret.Length -lt 16) {
    throw "KeySecret looks too short ($($trimmedKeySecret.Length) chars). Razorpay key secrets are usually 20+ characters."
}

if (-not $trimmedKeyId.StartsWith($envCfg.ExpectedPrefix)) {
    $msg = "KeyId '$($trimmedKeyId.Substring(0, [Math]::Min(12, $trimmedKeyId.Length)))...' does not start with '$($envCfg.ExpectedPrefix)' - that's the prefix expected for $($envCfg.RazorpayMode) on $Environment."
    if ($Force) {
        Write-Warning "$msg  (-Force was supplied; continuing anyway.)"
    } else {
        throw "$msg`nIf this is intentional (e.g. testing a live key on dev briefly), re-run with -Force."
    }
}

# ─── Pin az CLI to the correct subscription ───────────────────────────────
# MEDIUM: Prevents all az calls silently targeting the wrong subscription
# when the operator has multiple subscriptions and the wrong one is active.
$subJson = az account show --output json 2>$null
if ($subJson) {
    $currentSubId = ($subJson | ConvertFrom-Json).id
    az account set --subscription $currentSubId --output none
    Write-Host "az CLI subscription pinned: $currentSubId" -ForegroundColor DarkGray
}

# ─── PRD gate ─────────────────────────────────────────────────────────────
# MEDIUM: Require explicit confirmation before overwriting live Razorpay keys.
if ($Environment -eq 'prd') {
    Write-Host "`n  ⚠  You are about to rotate LIVE Razorpay keys on PRODUCTION." -ForegroundColor Red
    $prdConfirm = Read-Host "  Type 'yes' to continue"
    if ($prdConfirm -ne 'yes') { Write-Host "Aborted by operator." -ForegroundColor Yellow; exit 0 }
}

# ─── Confirm the target Function App exists (BEFORE backup) ───────────────
# HIGH: Moved before the backup so a wrong environment / typo fails fast
# rather than triggering a spurious backup first.
# HIGH: az functionapp show exits 3 when the app is missing. PS7.4+'s
# $PSNativeCommandUseErrorActionPreference (default $true) would convert
# that non-zero exit into a terminating error under $ErrorActionPreference
# = 'Stop', so we toggle it off and handle the code explicitly.
$savedNativePref = $PSNativeCommandUseErrorActionPreference
$PSNativeCommandUseErrorActionPreference = $false
try {
    $fnJson = az functionapp show `
        --resource-group $envCfg.ResourceGroup `
        --name           $envCfg.FunctionAppName `
        --output         json 2>$null
    $showExit = $LASTEXITCODE
} finally {
    $PSNativeCommandUseErrorActionPreference = $savedNativePref
}

if ($showExit -ne 0) {
    throw "Function App '$($envCfg.FunctionAppName)' not found in resource group '$($envCfg.ResourceGroup)' (az exit $showExit)."
}

# ─── Backup (after validation + existence check, so no backup on bad input) ─
try {
    & "$PSScriptRoot\Backup-function-settings.ps1" -KeyVaultName $envCfg.KeyVaultName -FunctionAppName $envCfg.FunctionAppName
    Write-Host "Function app settings backed up successfully." -ForegroundColor DarkGray
} catch {
    throw "Unable to back up function app settings for '$($envCfg.FunctionAppName)'. Error: $($_.Exception.Message)"
}

Write-Host ''
Write-Host "Target environment : $Environment" -ForegroundColor Cyan
Write-Host "Resource group     : $($envCfg.ResourceGroup)"
Write-Host "Function App       : $($envCfg.FunctionAppName)"
Write-Host "Razorpay mode      : $($envCfg.RazorpayMode)"
Write-Host "Expected key prefix: $($envCfg.ExpectedPrefix)"
Write-Host ''

# ─── Inspect current state for the log ────────────────────────────────────
$settingsJson = az functionapp config appsettings list `
    --resource-group $envCfg.ResourceGroup `
    --name $envCfg.FunctionAppName `
    2>$null

$current = if ($settingsJson) {
    ($settingsJson | ConvertFrom-Json) | Where-Object { $_.name -in @('RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET') }
} else {
    @()
}

if ($current) {
    Write-Host 'Existing Razorpay settings on this Function App:' -ForegroundColor Yellow
    foreach ($s in $current | Sort-Object name) {
        if ($s.name -eq 'RAZORPAY_KEY_ID') {
            # Safe to show - the key id is public anyway.
            Write-Host ("  {0} = {1}  (will overwrite)" -f $s.name, $s.value)
        } else {
            # Don't print the secret - just the length.
            Write-Host ("  {0} = ******** ({1} chars, will overwrite)" -f $s.name, $s.value.Length)
        }
    }
} else {
    Write-Host 'No existing Razorpay key settings found - adding new.' -ForegroundColor Yellow
}
Write-Host ''

# ─── Apply ─────────────────────────────────────────────────────────────────
Write-Host "Updating $($envCfg.FunctionAppName) RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET ..." -ForegroundColor Yellow

az functionapp config appsettings set `
    --resource-group $envCfg.ResourceGroup `
    --name $envCfg.FunctionAppName `
    --settings "RAZORPAY_KEY_ID=$trimmedKeyId" "RAZORPAY_KEY_SECRET=$trimmedKeySecret" `
    --output none

if ($LASTEXITCODE -ne 0) {
    throw "az functionapp config appsettings set failed with exit code $LASTEXITCODE."
}

# ─── Verify ────────────────────────────────────────────────────────────────
$appliedJson = az functionapp config appsettings list `
    --resource-group $envCfg.ResourceGroup `
    --name $envCfg.FunctionAppName `
    2>$null

if (-not $appliedJson) {
    throw "Verification failed - could not retrieve settings from '$($envCfg.FunctionAppName)' after update."
}

$applied = ($appliedJson | ConvertFrom-Json) |
    Where-Object { $_.name -in @('RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET') } |
    Sort-Object name

$appliedKeyId     = ($applied | Where-Object { $_.name -eq 'RAZORPAY_KEY_ID' }).value
$appliedKeySecret = ($applied | Where-Object { $_.name -eq 'RAZORPAY_KEY_SECRET' }).value

if ($appliedKeyId -ne $trimmedKeyId) {
    throw "Verification failed - RAZORPAY_KEY_ID on the Function App does not match what we sent."
}
if ($appliedKeySecret -ne $trimmedKeySecret) {
    throw "Verification failed - RAZORPAY_KEY_SECRET on the Function App does not match what we sent."
}

Write-Host ''
Write-Host '──────────────────────────────────────────────────────────────────────' -ForegroundColor Magenta
Write-Host "OK. $($envCfg.FunctionAppName) is now using:" -ForegroundColor Green
Write-Host ''
Write-Host "  RAZORPAY_KEY_ID     = $appliedKeyId" -ForegroundColor White
Write-Host ("  RAZORPAY_KEY_SECRET = ******** ({0} chars)" -f $appliedKeySecret.Length) -ForegroundColor White
Write-Host '──────────────────────────────────────────────────────────────────────' -ForegroundColor Magenta
Write-Host ''

Write-Host 'NEXT' -ForegroundColor Cyan
Write-Host '  - Restart is not required: Function App settings hot-reload on next invocation.'
Write-Host '  - Sanity check: open any page that triggers a Razorpay order create flow and confirm'
Write-Host "    the Checkout iframe opens with key '$appliedKeyId'."
Write-Host '  - If you also rotated the webhook secret, run Rotate-RazorpayWebhookSecret.ps1 next.'
Write-Host ''