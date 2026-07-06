# ==============================================================================
# Cleanup-KeyVault.ps1
#
# One-shot Key Vault hygiene.
#
# The DEV KV accumulated non-secret config values (ENVIRONMENT, CORS-ORIGIN,
# PUBLIC-SITE-URL, ...), hyphenated duplicates of the canonical camelCase
# secret set (JWT-SECRET vs JwtSecret), and test junk (test, TEST-DOT-DELETE)
# from earlier experiments. Everything the app actually uses lives under the
# canonical camelCase names - see $canonicalSecrets below.
#
# What this script does:
#   1. Enumerates every enabled secret in the vault.
#   2. Anything NOT in $canonicalSecrets is queued for delete (soft-delete).
#   3. Sets a 1-year `expires` attribute on each canonical secret so the
#      Portal surfaces a rotation warning when secrets get old.
#
# All deletions go through soft-delete (90-day retention). Purge is NOT
# performed - with EnablePurgeProtection=true on the vault, a subsequent
# manual purge is not possible until soft-delete expires anyway.
#
# Safe operations only. -DryRun by default; pass -Apply to actually
# perform the deletions + expiry writes.
# ==============================================================================

[CmdletBinding()]
param(
    [Parameter()]
    [ValidateSet('DEV', 'PRD')]
    [string]$Environment = 'DEV',

    [switch]$Apply,        # required to actually mutate; default is dry-run
    [switch]$Force         # skip PRD confirmation prompt
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
& "$PSScriptRoot\Azure-Connectivity.ps1"

# Canonical secret names - every current caller in
# Deploy-Infrastructure-v2.ps1 references one of these via
# @Microsoft.KeyVault(...). Anything else is candidate for delete.
$canonicalSecrets = @(
    'JwtSecret',
    'CsrfSigningKey',
    'InvoiceSigningKey',
    'RazorpayKeyId',
    'RazorpayKeySecret',
    'RazorpayWebhookSecret',
    'WhatsappAccessToken',
    'WhatsappAppSecret',
    'WhatsappWebhookVerifyToken',
    'WhatsappV2FunctionKey',
    'SmtpPass',
    'AzureOpenAIApiKey',
    'ApplicationInsightsConnectionString'
)

$config = @{
    DEV = @{ ResourceGroup = 'rg-thesrilathaarts-dev'; KeyVault = 'kv-thesrilathaarts-dev' }
    PRD = @{ ResourceGroup = 'rg-thesrilathaarts-prd'; KeyVault = 'kv-thesrilathaarts-prd' }
}
$envCfg = $config[$Environment]

Write-Host "`n╔═══════════════════════════════════════════════════════════════╗"
Write-Host "║   Key Vault hygiene                                           ║"
Write-Host "║   Environment: $($Environment.PadRight(47))║"
$modeLabel = if ($Apply) { 'APPLY' } else { 'DRY-RUN (pass -Apply to execute)' }
Write-Host "║   Mode:        $($modeLabel.PadRight(47))║"
Write-Host "╚═══════════════════════════════════════════════════════════════╝`n"

if ($Environment -eq 'PRD' -and $Apply) {
    Write-Host "  ⚠  You are about to modify PRODUCTION Key Vault." -ForegroundColor Red
    if ($Force) {
        Write-Host "  -Force supplied - skipping interactive confirmation." -ForegroundColor Yellow
    } else {
        $confirm = Read-Host "  Type 'yes' to continue"
        if ($confirm -ne 'yes') { Write-Host "Aborted."; exit 0 }
    }
}

$allSecrets = Get-AzKeyVaultSecret -VaultName $envCfg.KeyVault
$toDelete = @()
$toKeep = @()
foreach ($s in $allSecrets) {
    if ($canonicalSecrets -contains $s.Name) {
        $toKeep += $s
    } else {
        $toDelete += $s
    }
}

Write-Host "Canonical secrets present ($($toKeep.Count) of $($canonicalSecrets.Count)):" -ForegroundColor Cyan
foreach ($s in ($toKeep | Sort-Object Name)) {
    Write-Host ("  ✓  {0,-45} (updated {1})" -f $s.Name, $s.Updated.ToString('yyyy-MM-dd'))
}

$missing = $canonicalSecrets | Where-Object { $_ -notin ($toKeep | ForEach-Object Name) }
if ($missing) {
    Write-Host "`nCanonical secrets MISSING (script will not create - Deploy-Infrastructure-v2.ps1 seeds these):" -ForegroundColor Yellow
    foreach ($m in $missing) { Write-Host "  ×  $m" }
}

Write-Host "`nNon-canonical secrets (candidates for delete → soft-delete, $($toDelete.Count)):" -ForegroundColor Cyan
foreach ($s in ($toDelete | Sort-Object Name)) {
    $ageDays = [int]((Get-Date) - $s.Updated).TotalDays
    $prefix = if ($Apply) { 'DEL' } else { ' →' }
    Write-Host ("  {0}  {1,-45} (last updated {2}d ago)" -f $prefix, $s.Name, $ageDays)
}

if (-not $Apply) {
    Write-Host "`n(no changes made - dry-run; re-run with -Apply to delete + set expiries)`n"
    return
}

# ── Delete non-canonical secrets ──────────────────────────────────
$deleted = 0
foreach ($s in $toDelete) {
    try {
        Remove-AzKeyVaultSecret -VaultName $envCfg.KeyVault -Name $s.Name -Force -Confirm:$false | Out-Null
        Write-Host ("  ✓ deleted (soft) : {0}" -f $s.Name) -ForegroundColor Green
        $deleted++
    } catch {
        Write-Host ("  ✗ delete failed  : {0} - {1}" -f $s.Name, $_.Exception.Message) -ForegroundColor Red
    }
}

# ── Set 1-year expiry on canonical secrets that don't have one ────
# Update-AzKeyVaultSecret patches the attributes without needing to read
# the secret plaintext (Get-AzKeyVaultSecret's SecretValueText property
# was removed in Az 8+; the newer API returns SecretValue as SecureString).
$expiryTarget = (Get-Date).AddYears(1)
$expiriesSet = 0
foreach ($s in $toKeep) {
    $current = Get-AzKeyVaultSecret -VaultName $envCfg.KeyVault -Name $s.Name
    if ($current.Expires -and $current.Expires -gt (Get-Date).AddDays(30)) {
        Write-Host ("  – expires ok     : {0} ({1})" -f $s.Name, $current.Expires.ToString('yyyy-MM-dd')) -ForegroundColor DarkGray
    } else {
        try {
            Update-AzKeyVaultSecret `
                -VaultName $envCfg.KeyVault `
                -Name      $s.Name `
                -Version   $current.Version `
                -Expires   $expiryTarget | Out-Null
            Write-Host ("  ✓ expires set    : {0} → {1}" -f $s.Name, $expiryTarget.ToString('yyyy-MM-dd')) -ForegroundColor Green
            $expiriesSet++
        } catch {
            Write-Host ("  ✗ expiry failed  : {0} - {1}" -f $s.Name, $_.Exception.Message) -ForegroundColor Red
        }
    }
}

Write-Host "`nSummary: deleted=$deleted  expiries-set=$expiriesSet"
Write-Host "Soft-deleted secrets remain recoverable for 90 days via Undo-AzKeyVaultSecretRemoval.`n"
