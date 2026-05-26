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
    script writes BOTH in a single Update-AzFunctionAppSetting call.

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
    # Connect first
    . ./docs/Azure-Connectivity.ps1

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
      - Az.Accounts + Az.Functions modules installed
      - An active Az session (run docs/Azure-Connectivity.ps1 first)
        for a principal with Contributor or higher on the target
        Function App's resource group.

    Authoring notes:
      - The KeyId is only safe to print to the console (it's the value
        the browser sees when Razorpay Checkout opens). The KeySecret
        is NEVER printed; the script only logs its length after the
        Function App accepts the write.
      - Update-AzFunctionAppSetting merges with existing settings, so
        no other env vars are disturbed.
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

# ─── Environment → Azure resource mapping ──────────────────────────────────
$envMap = @{
    'dev' = @{
        ResourceGroup = 'rg-thesrilathaarts-dev'
        FunctionApp   = 'func-thesrilathaarts-dev'
        ExpectedPrefix = 'rzp_test_'
        RazorpayMode   = 'TEST mode'
    }
    'prd' = @{
        ResourceGroup = 'rg-thesrilathaarts-prd'
        FunctionApp   = 'func-thesrilathaarts-prd'
        ExpectedPrefix = 'rzp_live_'
        RazorpayMode   = 'LIVE mode'
    }
}
$envCfg = $envMap[$Environment]

Write-Host ''
Write-Host "Target environment : $Environment" -ForegroundColor Cyan
Write-Host "Resource group     : $($envCfg.ResourceGroup)"
Write-Host "Function App       : $($envCfg.FunctionApp)"
Write-Host "Razorpay mode      : $($envCfg.RazorpayMode)"
Write-Host "Expected key prefix: $($envCfg.ExpectedPrefix)"
Write-Host ''

# ─── Validate inputs ───────────────────────────────────────────────────────
$trimmedKeyId = $KeyId.Trim()
$trimmedKeySecret = $KeySecret.Trim()

if ($trimmedKeyId.Length -lt 16) {
    throw "KeyId looks too short ($($trimmedKeyId.Length) chars). Razorpay key ids are usually 20+ characters."
}
if ($trimmedKeySecret.Length -lt 16) {
    throw "KeySecret looks too short ($($trimmedKeySecret.Length) chars). Razorpay key secrets are usually 20+ characters."
}

if (-not $trimmedKeyId.StartsWith($envCfg.ExpectedPrefix)) {
    $msg = "KeyId '$($trimmedKeyId.Substring(0, [Math]::Min(12, $trimmedKeyId.Length)))...' does not start with '$($envCfg.ExpectedPrefix)' — that's the prefix expected for $($envCfg.RazorpayMode) on $Environment."
    if ($Force) {
        Write-Warning "$msg  (-Force was supplied; continuing anyway.)"
    } else {
        throw "$msg`nIf this is intentional (e.g. testing a live key on dev briefly), re-run with -Force."
    }
}

# ─── Confirm we have an Az session ─────────────────────────────────────────
$ctx = Get-AzContext -ErrorAction SilentlyContinue
if (-not $ctx) {
    throw "No Az session. Run docs/Azure-Connectivity.ps1 first."
}
Write-Host "Az context         : $($ctx.Account.Id) on $($ctx.Subscription.Name)" -ForegroundColor DarkGray
Write-Host ''

# ─── Confirm the target Function App exists ────────────────────────────────
Import-Module Az.Functions -ErrorAction Stop -WarningAction SilentlyContinue
$fn = Get-AzFunctionApp -ResourceGroupName $envCfg.ResourceGroup -Name $envCfg.FunctionApp -ErrorAction SilentlyContinue
if (-not $fn) {
    throw "Function App '$($envCfg.FunctionApp)' not found in '$($envCfg.ResourceGroup)'."
}

# ─── Inspect current state for the log ─────────────────────────────────────
$current = (Get-AzFunctionAppSetting -ResourceGroupName $envCfg.ResourceGroup -Name $envCfg.FunctionApp).GetEnumerator() |
    Where-Object { $_.Key -in @('RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET') }

if ($current) {
    Write-Host 'Existing Razorpay settings on this Function App:' -ForegroundColor Yellow
    foreach ($s in $current | Sort-Object Key) {
        if ($s.Key -eq 'RAZORPAY_KEY_ID') {
            # Safe to show — the key id is public anyway.
            Write-Host ("  {0} = {1}  (will overwrite)" -f $s.Key, $s.Value)
        } else {
            # Don't print the secret — just the length.
            Write-Host ("  {0} = ******** ({1} chars, will overwrite)" -f $s.Key, $s.Value.Length)
        }
    }
} else {
    Write-Host 'No existing Razorpay key settings — adding new.' -ForegroundColor Yellow
}
Write-Host ''

# ─── Apply ──────────────────────────────────────────────────────────────────
Write-Host "Updating $($envCfg.FunctionApp) RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET ..." -ForegroundColor Yellow
Update-AzFunctionAppSetting `
    -ResourceGroupName $envCfg.ResourceGroup `
    -Name $envCfg.FunctionApp `
    -AppSetting @{
        'RAZORPAY_KEY_ID'     = $trimmedKeyId
        'RAZORPAY_KEY_SECRET' = $trimmedKeySecret
    } `
    -Force -ErrorAction Stop | Out-Null

# ─── Verify ────────────────────────────────────────────────────────────────
$applied = (Get-AzFunctionAppSetting -ResourceGroupName $envCfg.ResourceGroup -Name $envCfg.FunctionApp).GetEnumerator() |
    Where-Object { $_.Key -in @('RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET') } |
    Sort-Object Key

$appliedKeyId     = ($applied | Where-Object { $_.Key -eq 'RAZORPAY_KEY_ID' }).Value
$appliedKeySecret = ($applied | Where-Object { $_.Key -eq 'RAZORPAY_KEY_SECRET' }).Value

if ($appliedKeyId -ne $trimmedKeyId) {
    throw "Verification failed — RAZORPAY_KEY_ID on the Function App does not match what we sent."
}
if ($appliedKeySecret.Length -ne $trimmedKeySecret.Length) {
    throw "Verification failed — RAZORPAY_KEY_SECRET length on the Function App differs from what we sent."
}

Write-Host ''
Write-Host '──────────────────────────────────────────────────────────────────────' -ForegroundColor Magenta
Write-Host "OK. $($envCfg.FunctionApp) is now using:" -ForegroundColor Green
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
