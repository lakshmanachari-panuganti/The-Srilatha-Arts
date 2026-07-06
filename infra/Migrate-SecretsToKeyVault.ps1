# ==============================================================================
# Migrate-SecretsToKeyVault.ps1
#
# One-shot migration of inline Function App secrets → Key Vault secrets.
#
# Reads each specified app setting from the target Function App and writes
# its value to Key Vault under the canonical name. Does NOT touch the app
# setting itself - Deploy-Infrastructure-v2.ps1 (via its $alwaysOverwrite
# block) replaces the inline value with a `@Microsoft.KeyVault(...)` ref
# on the next run.
#
# Sequencing:
#   1. Run this script first.  KV now holds the value.
#   2. Run Deploy-Infrastructure-v2.ps1.  App setting flips to KV ref,
#      Function App restarts, KV ref resolves to the value this script
#      just wrote.
#
# Idempotent: existing KV secrets with the same value are left as-is.
# ==============================================================================

[CmdletBinding()]
param(
    [Parameter()]
    [ValidateSet('DEV', 'PRD')]
    [string]$Environment = 'DEV',

    # Overwrite existing KV secrets even if the current value differs.
    # Off by default: existing values (JwtSecret, RazorpayKeyId, etc.)
    # are preserved - they were seeded via Deploy-Infrastructure-v2.ps1
    # and should not be replaced by inline app settings.
    [switch]$Overwrite,

    # Skip the PRD confirmation prompt (CI / non-interactive callers).
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
& "$PSScriptRoot\Azure-Connectivity.ps1"

# ── Mapping table: app-setting name → canonical KV secret name ────────
# Camel-case KV names match the working set (JwtSecret, CsrfSigningKey,
# InvoiceSigningKey) that Deploy-Infrastructure-v2.ps1 references today.
$secretMap = @(
    @{ App = 'WHATSAPP_ACCESS_TOKEN'; Kv = 'WhatsappAccessToken' }
    @{ App = 'WHATSAPP_APP_SECRET'; Kv = 'WhatsappAppSecret' }
    @{ App = 'WHATSAPP_WEBHOOK_VERIFY_TOKEN'; Kv = 'WhatsappWebhookVerifyToken' }
    @{ App = 'WHATSAPP_V2_FUNCTION_KEY'; Kv = 'WhatsappV2FunctionKey' }
    @{ App = 'RAZORPAY_KEY_ID'; Kv = 'RazorpayKeyId' }
    @{ App = 'RAZORPAY_KEY_SECRET'; Kv = 'RazorpayKeySecret' }
    @{ App = 'RAZORPAY_WEBHOOK_SECRET'; Kv = 'RazorpayWebhookSecret' }
    @{ App = 'SMTP_PASS'; Kv = 'SmtpPass' }
    @{ App = 'AZURE_OPENAI_API_KEY'; Kv = 'AzureOpenAIApiKey' }
    @{ App = 'APPLICATIONINSIGHTS_CONNECTION_STRING'; Kv = 'ApplicationInsightsConnectionString' }
)

$config = @{
    DEV = @{ ResourceGroup = 'rg-thesrilathaarts-dev'; FunctionApp = 'func-thesrilathaarts-dev'; KeyVault = 'kv-thesrilathaarts-dev' }
    PRD = @{ ResourceGroup = 'rg-thesrilathaarts-prd'; FunctionApp = 'func-thesrilathaarts-prd'; KeyVault = 'kv-thesrilathaarts-prd' }
}
$envCfg = $config[$Environment]

Write-Host "`n╔═══════════════════════════════════════════════════════════════╗"
Write-Host "║   Migrate inline Function App secrets → Key Vault             ║"
Write-Host "║   Environment: $($Environment.PadRight(47))║"
Write-Host "╚═══════════════════════════════════════════════════════════════╝`n"

if ($Environment -eq 'PRD') {
    Write-Host "  ⚠  You are about to modify PRODUCTION Key Vault." -ForegroundColor Red
    if ($Force) {
        Write-Host "  -Force supplied - skipping interactive confirmation." -ForegroundColor Yellow
    } else {
        $confirm = Read-Host "  Type 'yes' to continue"
        if ($confirm -ne 'yes') { Write-Host "Aborted."; exit 0 }
    }
}

$migrated = 0; $skipped = 0; $missing = 0

foreach ($item in $secretMap) {
    $appName = $item.App
    $kvName = $item.Kv

    # Read current inline value from the Function App
    $inlineValue = az functionapp config appsettings list `
        --name           $envCfg.FunctionApp `
        --resource-group $envCfg.ResourceGroup `
        --query          "[?name=='$appName'].value | [0]" `
        --output         tsv 2>$null

    if ([string]::IsNullOrEmpty($inlineValue)) {
        Write-Host ("  ×  {0,-45} → app setting empty / absent, skip" -f $appName) -ForegroundColor DarkGray
        $missing++
        continue
    }

    # KV reference values ('@Microsoft.KeyVault(...)') shouldn't be migrated
    if ($inlineValue -like '@Microsoft.KeyVault(*') {
        Write-Host ("  –  {0,-45} → already a KV reference, skip" -f $appName) -ForegroundColor DarkGray
        $skipped++
        continue
    }

    # Check existing KV secret
    $existing = az keyvault secret show `
        --vault-name $envCfg.KeyVault `
        --name       $kvName `
        --query      value `
        --output     tsv 2>$null

    if ($existing -eq $inlineValue) {
        Write-Host ("  =  {0,-45} → KV already matches, skip" -f $appName) -ForegroundColor DarkGreen
        $skipped++
        continue
    }

    # 'replace-me' is the placeholder Deploy-Infrastructure-v2.ps1 seeds
    # on fresh envs. Always overwrite that with the real inline value.
    $isPlaceholder = $existing -eq 'replace-me'

    if (-not [string]::IsNullOrEmpty($existing) -and -not $Overwrite -and -not $isPlaceholder) {
        Write-Host ("  !  {0,-45} → KV secret '{1}' has a DIFFERENT value; not overwriting (pass -Overwrite to force)" -f $appName, $kvName) -ForegroundColor Yellow
        $skipped++
        continue
    }

    # Write to KV
    Set-AzKeyVaultSecret `
        -VaultName $envCfg.KeyVault `
        -Name      $kvName `
        -SecretValue (ConvertTo-SecureString $inlineValue -AsPlainText -Force) `
    | Out-Null

    Write-Host ("  ✓  {0,-45} → KV secret '{1}' written" -f $appName, $kvName) -ForegroundColor Green
    $migrated++
}

Write-Host "`nSummary: migrated=$migrated  skipped=$skipped  missing=$missing"
Write-Host "Next step: run infra\Deploy-Infrastructure-v2.ps1 -Environment $Environment  to flip the app settings to KV refs.`n"
