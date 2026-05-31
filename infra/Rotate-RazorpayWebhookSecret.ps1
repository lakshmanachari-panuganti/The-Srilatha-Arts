<#
.SYNOPSIS
    Generates a fresh Razorpay webhook signing secret and writes it to the
    matching Function App's RAZORPAY_WEBHOOK_SECRET app setting.

.DESCRIPTION
    Razorpay's webhook signing secret is a value we choose, register in the
    Razorpay Dashboard (Settings -> Webhooks -> Add new), and tell our backend
    via env var. Both sides must hold the same byte-for-byte string for HMAC
    verification to succeed.

    This script does the Azure half of that flow:

      1. Generates 32 cryptographically random bytes, base64-encoded.
      2. Updates the named Function App's RAZORPAY_WEBHOOK_SECRET app setting.
      3. Prints the secret to the console so you can paste it into the
         Razorpay Dashboard webhook entry that targets the matching URL.

    The secret never touches a file on disk. The console output is the only
    place you'll see it after the run. Razorpay also never reveals it back
    after you save it — so write it down or trust the Function App app
    setting as the only source of truth.

.PARAMETER Environment
    Either 'dev' or 'prd'. Picks the correct resource group + Function App
    name + the matching Razorpay dashboard mode (test vs live) that you
    must register the secret in.

.PARAMETER WebhookSecret
    Optional. If supplied, this exact value is used instead of generating
    a new one. Useful if you've already typed a value into Razorpay and
    just need to sync it to Azure.

.EXAMPLE
    # Rotate the DEV webhook secret end-to-end.
    Connect-AzAccount -ServicePrincipal ...
    ./Rotate-RazorpayWebhookSecret.ps1 -Environment dev

.EXAMPLE
    # Use a value you already pasted into the Razorpay dashboard.
    ./Rotate-RazorpayWebhookSecret.ps1 -Environment prd -WebhookSecret 'PbykpHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'

.NOTES
    Requires:
      - Az.Accounts + Az.Functions modules installed
      - An active Az session (Connect-AzAccount) for a principal with
        Contributor or higher on the target Function App's resource group.

    Authoring notes:
      - We use Update-AzFunctionAppSetting which MERGES with existing
        settings (no risk of wiping the other env vars).
      - Random bytes come from RandomNumberGenerator, which is a CSPRNG.
        Math.Random / Get-Random are deliberately not used.
#>

[CmdletBinding()]
param(
    [Parameter()]
    [ValidateSet('dev', 'prd')]
    [string]$Environment = 'prd',

    [Parameter()]
    [string]$WebhookSecret
)

$ErrorActionPreference = 'Stop'

# ─── Environment → Azure resource mapping ──────────────────────────────────
$AppSlug = "thesrilathaarts"
$envMap = @{
    "dev" = @{
        ResourceGroup   = "rg-$AppSlug-dev"
        FunctionAppName = "func-$AppSlug-dev"
        FrontendUrl     = "https://delightful-mushroom-062e18100.7.azurestaticapps.net"
        WebhookUrl      = "https://func-$AppSlug-dev.azurewebsites.net/api/razorpay/webhook"
        RazorpayMode    = "TEST mode (rzp_test_... keys)"
        KeyVaultName    = "kv-$AppSlug-dev"
    }
    "prd" = @{
        ResourceGroup   = "rg-$AppSlug-prd"
        FunctionAppName = "func-$AppSlug-prd"
        FrontendUrl     = "https://www.srilatha.art"
        WebhookUrl      = "https://www.srilatha.art/api/razorpay/webhook"
        RazorpayMode    = "LIVE mode (rzp_live_... keys)"
        KeyVaultName    = "kv-$AppSlug-dev"
    }
}
$envCfg = $envMap[$Environment]
try {
    & "$PSScriptRoot\Backup-function-settings.ps1" `
        -KeyVaultName $envCfg.KeyVaultName `
        -FunctionAppName $envCfg.FunctionAppName
    Write-Host "Function app setting backed up successfully"
} catch {
    throw "Unable to back up function app settings for '$($envCfg.FunctionAppName)'. Error: $($_.Exception.Message)"
}

Write-Host ''
Write-Host "Target environment : $Environment" -ForegroundColor Cyan
Write-Host "Resource group     : $($envCfg.ResourceGroup)"
Write-Host "Function App       : $($envCfg.FunctionApp)"
Write-Host "Razorpay mode      : $($envCfg.RazorpayMode)"
Write-Host "Webhook URL        : $($envCfg.WebhookUrl)"
Write-Host ''

# ─── Confirm we have an Az session ─────────────────────────────────────────
$ctx = Get-AzContext -ErrorAction SilentlyContinue
if (-not $ctx) {
    throw "No Az session. Run Connect-AzAccount first (see docs/Azure-Connectivity.ps1)."
}
Write-Host "Az context         : $($ctx.Account.Id) on $($ctx.Subscription.Name)" -ForegroundColor DarkGray
Write-Host ''

# ─── Confirm the target Function App exists ────────────────────────────────
Import-Module Az.Functions -ErrorAction Stop -WarningAction SilentlyContinue
$fn = Get-AzFunctionApp -ResourceGroupName $envCfg.ResourceGroup -Name $envCfg.FunctionAppName -ErrorAction SilentlyContinue
if (-not $fn) {
    throw "Function App '$($envCfg.FunctionApp)' not found in '$($envCfg.ResourceGroup)'."
}

# ─── Get-or-generate the secret ────────────────────────────────────────────
if ([string]::IsNullOrWhiteSpace($WebhookSecret)) {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $WebhookSecret = [Convert]::ToBase64String($bytes)
    $generated = $true
} else {
    if ($WebhookSecret.Length -lt 16) {
        throw "Provided WebhookSecret is too short ($($WebhookSecret.Length) chars). Use 32+ characters."
    }
    $generated = $false
}

# ─── Check current value, then overwrite ──────────────────────────────────
# Update-AzFunctionAppSetting performs a MERGE — keys you don't pass are
# left alone, keys you DO pass get overwritten unconditionally. So this is
# already an "overwrite if exists, add if missing" operation. We just log
# the before-state explicitly so the run output is self-explanatory.
$existing = (Get-AzFunctionAppSetting -ResourceGroupName $envCfg.ResourceGroup -Name $envCfg.FunctionApp).GetEnumerator() |
    Where-Object { $_.Key -eq 'RAZORPAY_WEBHOOK_SECRET' }

if ($existing) {
    Write-Host "Existing setting found — will overwrite (was $($existing.Value.Length) chars)." -ForegroundColor Yellow
} else {
    Write-Host 'No existing setting on this Function App — will add a new one.' -ForegroundColor Yellow
}

Write-Host "Updating $($envCfg.FunctionApp) RAZORPAY_WEBHOOK_SECRET ..." -ForegroundColor Yellow
Update-AzFunctionAppSetting `
    -ResourceGroupName $envCfg.ResourceGroup `
    -Name $envCfg.FunctionAppName `
    -AppSetting @{ 'RAZORPAY_WEBHOOK_SECRET' = $WebhookSecret } `
    -Force -ErrorAction Stop | Out-Null

# Verify by reading back the length (NOT the value — keep it off any logs
# that might be retained by the host).
$applied = (Get-AzFunctionAppSetting -ResourceGroupName $envCfg.ResourceGroup -Name $envCfg.FunctionApp).GetEnumerator() |
    Where-Object { $_.Key -eq 'RAZORPAY_WEBHOOK_SECRET' }

if (-not $applied -or $applied.Value.Length -ne $WebhookSecret.Length) {
    throw "Verification failed — the setting did not land. Try again."
}
Write-Host "OK. RAZORPAY_WEBHOOK_SECRET now $($applied.Value.Length) chars on Function App." -ForegroundColor Green
Write-Host ''

# ─── Print the secret + next step instructions ─────────────────────────────
Write-Host '──────────────────────────────────────────────────────────────────────' -ForegroundColor Magenta
if ($generated) {
    Write-Host 'NEW WEBHOOK SECRET — copy this NOW, it will not be shown again:' -ForegroundColor Magenta
} else {
    Write-Host 'WEBHOOK SECRET (the one you passed in):' -ForegroundColor Magenta
}
Write-Host ''
Write-Host "    $WebhookSecret" -ForegroundColor White -BackgroundColor DarkBlue
Write-Host ''
Write-Host '──────────────────────────────────────────────────────────────────────' -ForegroundColor Magenta
Write-Host ''
Write-Host "NEXT — Razorpay Dashboard ($($envCfg.RazorpayMode))" -ForegroundColor Cyan
Write-Host '  1. Toggle the Test/Live switch to the matching mode at the top right.'
Write-Host '  2. Account & Settings -> Webhooks -> Add new webhook (or edit existing).'
Write-Host "  3. Webhook URL : $($envCfg.WebhookUrl)"
Write-Host '  4. Secret      : paste the value printed above.'
Write-Host '  5. Tick events : payment.captured, payment.failed (minimum).'
Write-Host '  6. Save. Then click the new webhook -> "Test webhook" -> payment.captured.'
Write-Host '     Recent Deliveries should show HTTP 200 within a few seconds.'
Write-Host ''
