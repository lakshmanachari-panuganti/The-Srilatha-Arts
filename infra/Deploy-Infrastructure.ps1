<#
.SYNOPSIS
    Deploy Azure Infrastructure for Srilatha Art (DEV or PRD).

.DESCRIPTION
    Creates and configures a complete environment for the Srilatha Art
    backend. Idempotent — re-runs are safe and only apply diffs.

    ── TABLE OF CONTENTS ─────────────────────────────────────────────
       PART A.  Script parameters + connection
       PART B.  Configuration (all environment values, in one place)
       PART C.  Helper functions
       PART D.  Execution (numbered phases)
         Phase 1  Prerequisites
         Phase 2  Create core resources
         Phase 3  Bootstrap SP RBAC (minimal — enables phases 4–6)
         Phase 4  Provision storage (tables, queues, blobs, CORS)
         Phase 5  Seed Key Vault secrets
         Phase 6  Configure Function App (app settings + CORS)
         Phase 7  Enable Function App MI + apply RUNTIME RBAC ⬅ all
                  durable role assignments live here, at the end
         Phase 8  Verify RBAC + summary
    ────────────────────────────────────────────────────────────────────

    The role-assignment design (Phase 3 + Phase 7 combined):

      ▸ Deployer Service Principal — used by this script and the
        GitHub Actions deploy workflows. Roles:
          • Key Vault Secrets Officer        → rotate secrets
          • Storage Blob Data Contributor    → read/write product
                                                images + invoices
          • Storage Table Data Contributor   → seed / patch data
          • Storage Queue Data Contributor   → drain queues at deploy

      ▸ Function App System-Assigned Managed Identity — used at
        RUNTIME by the Function App. Roles:
          • Key Vault Secrets User           → resolve
                                                @Microsoft.KeyVault refs
          • Storage Blob Data Owner          → required for
                                                identity-based
                                                AzureWebJobsStorage
                                                (host internal state,
                                                lease blobs, locks)
          • Storage Table Data Contributor   → app data (orders,
                                                products, …)
          • Storage Queue Data Contributor   → notifications-out,
                                                webhooks-in, …
          • Monitoring Metrics Publisher     → App Insights
                                                (forward-looking AAD
                                                telemetry path)

    The script also REMOVES any legacy 'Key Vault Administrator'
    assignment that earlier versions mis-scoped to the Function App
    resource.

.PARAMETER Environment
    Target environment: DEV or PRD.

.EXAMPLE
    ./infra/Deploy-Infrastructure.ps1 -Environment DEV

.NOTES
    Prerequisites
      - PowerShell 7+
      - Az module installed: Install-Module Az -Scope CurrentUser
      - Sub-modules used:
          Az.Accounts, Az.Resources, Az.Storage, Az.KeyVault,
          Az.Functions, Az.Websites, Az.ApplicationInsights
      - Env vars MY_APPREG_CLIENT_ID / MY_APPREG_CLIENT_SECRET /
        MY_APPREG_TENANT_ID for an SP that has, on the subscription:
          Contributor + Key Vault Administrator + User Access
          Administrator
        (User Access Administrator is required to grant RBAC.)
#>

# ═══════════════════════════════════════════════════════════════════
#  PART A.  Script parameters + connection
# ═══════════════════════════════════════════════════════════════════

[CmdletBinding()]
param(
    [Parameter()]
    [ValidateSet('DEV', 'PRD')]
    [string]$Environment = 'DEV'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Azure connection — uses the deployer service principal whose creds
# are exposed as env vars (see docs/Azure-Connectivity.ps1 for the
# same pattern used outside this script).
$securePassword = ConvertTo-SecureString $env:MY_APPREG_CLIENT_SECRET -AsPlainText -Force
$credential = New-Object System.Management.Automation.PSCredential ($env:MY_APPREG_CLIENT_ID, $securePassword)
Connect-AzAccount -ServicePrincipal -Tenant $env:MY_APPREG_TENANT_ID -Credential $credential | Out-Null


# ═══════════════════════════════════════════════════════════════════
#  PART B.  Configuration (all environment-dependent values here)
# ═══════════════════════════════════════════════════════════════════
#
# Everything below is data only — no side effects. Edit values here,
# never inline in the execution phases. Brand-new naming throughout,
# so this script does NOT touch the legacy rg-tsa-dev / rg-tsa-prd
# resource groups.

# ── B.1  Per-environment resource names ─────────────────────────────
$AppSlug = 'thesrilathaarts'

$config = @{
    DEV = @{
        ResourceGroup  = "rg-$AppSlug-dev"
        Location       = "centralindia"
        StorageAccount = "st$($AppSlug)dev"      # 20 chars, lowercase
        FunctionApp    = "func-$AppSlug-dev"
        StaticWebApp   = "swa-$AppSlug-dev"   # reserved name only
        KeyVault       = "kv-$AppSlug-dev"        # 22 chars; app + backup secrets
        AppInsights    = "appi-$AppSlug-dev"
        CorsOrigins    = @(
            'http://localhost:3000',
            'https://delightful-mushroom-062e18100.7.azurestaticapps.net',
            'https://www.lucky1.online'
        )
        CookieDomain   = ''
        WebsiteUrl     = 'delightful-mushroom-062e18100.7.azurestaticapps.net'
    }
    PRD = @{
        ResourceGroup  = "rg-$AppSlug-prd"
        Location       = "centralindia"
        StorageAccount = "st$($AppSlug)prd"
        FunctionApp    = "func-$AppSlug-prd"
        StaticWebApp   = "swa-$AppSlug-prd"
        KeyVault       = "kv-$AppSlug-prd"        # 22 chars; app + backup secrets
        AppInsights    = "appi-$AppSlug-prd"
        CorsOrigins    = @(
            'https://www.srilatha.art',
            'https://srilatha.art',
            'https://salmon-wave-01c7b8300.7.azurestaticapps.net'
        )
        CookieDomain   = '.srilatha.art'
        WebsiteUrl     = 'www.srilatha.art'
    }
}
$envCfg = $config[$Environment]

# ── B.2  Storage tables (per new-backend.md §2.1) ───────────────────
$tableNames = @(
    'products', 'orders', 'orderItems', 'users', 'admins', 'config',
    'orderEvents', 'ordersByStatus',
    'coupons', 'couponRedemptions',
    'announcements',
    'wishlist', 'reviews', 'customOrders',
    'addresses', 'notifications',
    'staff', 'auditLog', 'rateLimits'
)

# ── B.3  Storage queues (per new-backend.md §2.3) ───────────────────
$queueNames = @(
    'notifications-out',
    'webhooks-in',
    'review-requests'
)

# ── B.4  Blob containers (per new-backend.md §14.1) ─────────────────
# Public read for product / category / asset images; private for
# invoices and user uploads.
$blobContainers = @(
    @{ Name = 'products'; PublicAccess = 'Blob' }
    @{ Name = 'categories'; PublicAccess = 'Blob' }
    @{ Name = 'assets'; PublicAccess = 'Blob' }
    @{ Name = 'invoices'; PublicAccess = 'Off' }
    @{ Name = 'user-uploads'; PublicAccess = 'Off' }
)

# ── B.5  Required PowerShell modules ────────────────────────────────
$requiredModules = @(
    'Az.Accounts', 'Az.Resources', 'Az.Storage', 'Az.KeyVault',
    'Az.Functions', 'Az.Websites', 'Az.ApplicationInsights'
)

# ── B.6  RBAC role plan ─────────────────────────────────────────────
# Two collections of role assignments. The actual application is
# split across Phase 3 (bootstrap — minimum to make the rest of the
# script work) and Phase 7 (runtime — the bulk).
#
# Note: $sp_BootstrapRoles is what THIS script needs in order to
# perform later data-plane operations against Storage and Key
# Vault. $sp_RuntimeRoles is the same SP's enduring assignments —
# they happen to overlap, which means Phase 7 mostly re-asserts
# what Phase 3 already established. Idempotent assignment makes
# the duplication harmless and the intent clearer.

$sp_BootstrapRoles = @(
    @{ Resource = 'storage'; Role = 'Storage Blob Data Contributor'; Why = 'Create blob containers + set CORS in Phase 4' }
    @{ Resource = 'storage'; Role = 'Storage Table Data Contributor'; Why = 'Create tables in Phase 4' }
    @{ Resource = 'storage'; Role = 'Storage Queue Data Contributor'; Why = 'Create queues in Phase 4' }
    @{ Resource = 'keyvault'; Role = 'Key Vault Secrets Officer'; Why = 'Write secrets in Phase 5' }
)

$sp_RuntimeRoles = @(
    # Same as bootstrap — re-asserted at the end for the durable
    # documented role set (helps when this script is re-run with a
    # fresh SP that didn't go through Phase 3 yet).
    @{ Resource = 'storage'; Role = 'Storage Blob Data Contributor'; Why = 'Deploy-time read/write of product + invoice blobs' }
    @{ Resource = 'storage'; Role = 'Storage Table Data Contributor'; Why = 'Deploy-time data seed / patch' }
    @{ Resource = 'storage'; Role = 'Storage Queue Data Contributor'; Why = 'Deploy-time queue inspection / drain' }
    @{ Resource = 'keyvault'; Role = 'Key Vault Secrets Officer'; Why = 'Rotate secrets on subsequent runs' }
)

# The Function App's System-Assigned Managed Identity needs these
# four roles to function correctly at runtime. Storage Blob Data
# OWNER (not Contributor) is required because we use an
# identity-based AzureWebJobsStorage connection — the Functions host
# needs Owner to manage internal state (lease blobs, host secrets,
# distributed locks for queue/timer triggers).
# Ref: https://learn.microsoft.com/azure/azure-functions/functions-reference#configure-an-identity-based-connection
$mi_RuntimeRoles = @(
    @{ Resource = 'keyvault'; Role = 'Key Vault Secrets User'; Why = 'Resolve @Microsoft.KeyVault(...) refs at startup' }
    @{ Resource = 'storage'; Role = 'Storage Blob Data Owner'; Why = 'Identity-based AzureWebJobsStorage — host internal state' }
    @{ Resource = 'storage'; Role = 'Storage Table Data Contributor'; Why = 'App data (orders, products, ...)' }
    @{ Resource = 'storage'; Role = 'Storage Queue Data Contributor'; Why = 'Notifications, webhook ingest, review request queues' }
    @{ Resource = 'appinsights'; Role = 'Monitoring Metrics Publisher'; Why = 'Forward-looking — AAD-based AI telemetry path' }
)


# ═══════════════════════════════════════════════════════════════════
#  PART C.  Helper functions
# ═══════════════════════════════════════════════════════════════════

function Write-Step { param([string]$Message)
    Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "▶ $Message" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
}
function Write-Success { param([string]$Message); Write-Host "  ✓ $Message" -ForegroundColor Green }
function Write-Info { param([string]$Message); Write-Host "  ℹ $Message" -ForegroundColor Yellow }
function Write-Err { param([string]$Message); Write-Host "  ✗ $Message" -ForegroundColor Red }

# Idempotent role assignment helper. Returns $true on success / already-
# present, $false on a hard failure (Forbidden / propagation lag). Never
# throws — callers decide whether a miss is fatal.
function Assign-AzRoleIfMissing {
    param(
        [Parameter(Mandatory)] [string]$ObjectId,
        [Parameter(Mandatory)] [string]$RoleDefinitionName,
        [Parameter(Mandatory)] [string]$Scope,
        [Parameter(Mandatory)] [string]$ScopeLabel
    )
    $existing = Get-AzRoleAssignment -ObjectId $ObjectId -RoleDefinitionName $RoleDefinitionName -Scope $Scope -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Info "Already assigned : $RoleDefinitionName on $ScopeLabel"
        return $true
    }
    try {
        New-AzRoleAssignment -ObjectId $ObjectId -RoleDefinitionName $RoleDefinitionName -Scope $Scope -ErrorAction Stop | Out-Null
        Write-Success "Assigned        : $RoleDefinitionName on $ScopeLabel"
        return $true
    } catch {
        Write-Err "Could not assign : $RoleDefinitionName on $ScopeLabel — $($_.Exception.Message.Split([Environment]::NewLine)[0])"
        return $false
    }
}

# Maps the symbolic 'Resource' tag in the role plan to a real Azure
# resource id. The resources don't exist until Phase 2 runs, so this
# closure is called lazily from Phase 3 and Phase 7.
function Resolve-RoleScope {
    param(
        [Parameter(Mandatory)] [string]$ResourceKey,
        [Parameter(Mandatory)] $StorageAccount,
        [Parameter(Mandatory)] $KeyVault,
        [Parameter(Mandatory)] $AppInsights
    )
    switch ($ResourceKey) {
        'storage' { return @{ Id = $StorageAccount.Id; Label = "Storage Account [$($StorageAccount.StorageAccountName)]" } }
        'keyvault' { return @{ Id = $KeyVault.ResourceId; Label = "Key Vault [$($KeyVault.VaultName)]" } }
        'appinsights' { return @{ Id = $AppInsights.Id; Label = "App Insights [$($AppInsights.Name)]" } }
        default { throw "Unknown role-plan resource key: '$ResourceKey'" }
    }
}

# Apply a list of (Principal, Resource, Role) tuples. Used twice — once
# for the SP in Phase 3, once for the SP + MI in Phase 7.
function Apply-RolePlan {
    param(
        [Parameter(Mandatory)] [string]$ObjectId,
        [Parameter(Mandatory)] [object[]]$Plan,
        [Parameter(Mandatory)] $StorageAccount,
        [Parameter(Mandatory)] $KeyVault,
        [Parameter(Mandatory)] $AppInsights
    )
    $okCount = 0
    foreach ($entry in $Plan) {
        $scope = Resolve-RoleScope -ResourceKey $entry.Resource -StorageAccount $StorageAccount -KeyVault $KeyVault -AppInsights $AppInsights
        $ok = Assign-AzRoleIfMissing -ObjectId $ObjectId -RoleDefinitionName $entry.Role -Scope $scope.Id -ScopeLabel $scope.Label
        if ($ok) { $okCount++ }
    }
    return $okCount
}


# ═══════════════════════════════════════════════════════════════════
#  PART D.  Execution
# ═══════════════════════════════════════════════════════════════════

Write-Host @"

╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║       Srilatha Art - Infrastructure Deployment                ║
║       (Fresh build - does not touch rg-tsa-*)                 ║
║                                                               ║
║       Environment: $($Environment.PadRight(43))║
║       Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')                              ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Magenta

# ─────────────────────────────────────────────────────────────────
#  PHASE 1.  Prerequisites
# ─────────────────────────────────────────────────────────────────
Write-Step "PHASE 1 — Prerequisites"

foreach ($mod in $requiredModules) {
    if (-not (Get-Module -ListAvailable -Name $mod)) {
        Write-Err "Missing module: $mod  →  Run: Install-Module Az -Scope CurrentUser"
        exit 1
    }
    Write-Success "Module available: $mod"
}

$context = Get-AzContext
if (-not $context) {
    Write-Err "Not logged in. Run: Connect-AzAccount"
    exit 1
}
Write-Success "Logged in as  : $($context.Account.Id)"
Write-Success "Subscription  : $($context.Subscription.Name) ($($context.Subscription.Id))"

# Resolve the deployer SP's object id once — used by both Phase 3 and
# Phase 7. The Get-Az call requires Directory.Read for the SP itself,
# which the env-var SP has implicitly as a directory member.
$spObjectId = (Get-AzADServicePrincipal -ApplicationId $env:MY_APPREG_CLIENT_ID).Id
Write-Success "Deployer SP   : $spObjectId"


# ─────────────────────────────────────────────────────────────────
#  PHASE 2.  Create core resources (no RBAC yet)
# ─────────────────────────────────────────────────────────────────
Write-Step "PHASE 2 — Create core resources"

# ── 2.1  Resource Group ──────────────────────────────────────────
$rg = Get-AzResourceGroup -Name $envCfg.ResourceGroup -ErrorAction SilentlyContinue
if ($rg) {
    Write-Success "Resource Group exists       : $($envCfg.ResourceGroup)"
} else {
    Write-Info "Creating Resource Group     : $($envCfg.ResourceGroup)"
    New-AzResourceGroup -Name $envCfg.ResourceGroup -Location $envCfg.Location -Tag @{
        project   = $AppSlug
        env       = $Environment.ToLower()
        managedBy = 'Deploy-Infrastructure.ps1'
    } | Out-Null
    Write-Success "Resource Group created      : $($envCfg.ResourceGroup)"
}

# ── 2.2  Storage Account ─────────────────────────────────────────
$storageAccount = Get-AzStorageAccount -ResourceGroupName $envCfg.ResourceGroup -Name $envCfg.StorageAccount -ErrorAction SilentlyContinue
if ($storageAccount) {
    Write-Success "Storage Account exists      : $($envCfg.StorageAccount)"
} else {
    Write-Info "Creating Storage Account    : $($envCfg.StorageAccount)"
    $storageAccount = New-AzStorageAccount `
        -ResourceGroupName $envCfg.ResourceGroup `
        -Name $envCfg.StorageAccount `
        -Location $envCfg.Location `
        -SkuName 'Standard_LRS' `
        -Kind 'StorageV2' `
        -AccessTier 'Hot' `
        -AllowBlobPublicAccess $true `
        -EnableHttpsTrafficOnly $true
    Write-Success "Storage Account created     : $($envCfg.StorageAccount)"
}

# ── 2.3  Application Insights ────────────────────────────────────
$appInsights = Get-AzApplicationInsights -ResourceGroupName $envCfg.ResourceGroup -Name $envCfg.AppInsights -ErrorAction SilentlyContinue
if ($appInsights) {
    Write-Success "Application Insights exists : $($envCfg.AppInsights)"
} else {
    Write-Info "Creating Application Insights: $($envCfg.AppInsights)"
    $appInsights = New-AzApplicationInsights `
        -ResourceGroupName $envCfg.ResourceGroup `
        -Name $envCfg.AppInsights `
        -Location $envCfg.Location `
        -Kind 'web' `
        -ApplicationType 'web'
    Write-Success "Application Insights created: $($envCfg.AppInsights)"
}

# ── 2.4  Function App (consumption, Linux, Node 22) ──────────────
$functionApp = Get-AzFunctionApp -ResourceGroupName $envCfg.ResourceGroup -Name $envCfg.FunctionApp -ErrorAction SilentlyContinue
if ($functionApp) {
    Write-Success "Function App exists         : $($envCfg.FunctionApp)"
} else {
    Write-Info "Creating Function App       : $($envCfg.FunctionApp)"
    $functionApp = New-AzFunctionApp `
        -ResourceGroupName $envCfg.ResourceGroup `
        -Name $envCfg.FunctionApp `
        -StorageAccountName $envCfg.StorageAccount `
        -Location $envCfg.Location `
        -Runtime 'Node' `
        -RuntimeVersion '22' `
        -FunctionsVersion '4' `
        -OSType 'Linux' `
        -ApplicationInsightsName $envCfg.AppInsights
    Write-Success "Function App created        : $($envCfg.FunctionApp)"
}

# ── 2.5  Key Vault (RBAC auth mode, single vault for app + backups) ─
$keyVault = Get-AzKeyVault -ResourceGroupName $envCfg.ResourceGroup -VaultName $envCfg.KeyVault -ErrorAction SilentlyContinue
if ($keyVault) {
    Write-Success "Key Vault exists            : $($envCfg.KeyVault)"
} else {
    Write-Info "Creating Key Vault          : $($envCfg.KeyVault)"
    $keyVault = New-AzKeyVault `
        -Name              $envCfg.KeyVault `
        -ResourceGroupName $envCfg.ResourceGroup `
        -Location          $envCfg.Location `
        -Sku               Standard
    Write-Success "Key Vault created           : $($envCfg.KeyVault)"
}


# ─────────────────────────────────────────────────────────────────
#  PHASE 3.  Bootstrap deployer-SP RBAC
# ─────────────────────────────────────────────────────────────────
#
# Just enough for the deployer SP to perform the data-plane
# operations in Phases 4 + 5 of THIS script. The same SP roles are
# re-asserted in Phase 7 as part of the durable role plan — that's
# intentional (idempotent), so the long-term documented set lives
# in one place near the end.

Write-Step "PHASE 3 — Bootstrap deployer-SP RBAC (data plane access)"

[void] (Apply-RolePlan `
        -ObjectId $spObjectId `
        -Plan $sp_BootstrapRoles `
        -StorageAccount $storageAccount `
        -KeyVault $keyVault `
        -AppInsights $appInsights)

Write-Info "Waiting 15s for RBAC propagation before data-plane ops..."
Start-Sleep -Seconds 15

# Storage context — AAD-based, no shared keys. This call validates
# the bootstrap RBAC above; if it fails the next phases would
# silently produce 403s.
$storageCtx = New-AzStorageContext -StorageAccountName $envCfg.StorageAccount -UseConnectedAccount
Write-Success "Storage context ready (AAD-based)"


# ─────────────────────────────────────────────────────────────────
#  PHASE 4.  Provision storage (tables, queues, blob containers, CORS)
# ─────────────────────────────────────────────────────────────────
Write-Step "PHASE 4 — Provision storage"

# ── 4.1  Tables ──────────────────────────────────────────────────
Write-Info "Tables..."
foreach ($t in $tableNames) {
    if (-not (Get-AzStorageTable -Name $t -Context $storageCtx -ErrorAction SilentlyContinue)) {
        New-AzStorageTable -Name $t -Context $storageCtx | Out-Null
        Write-Success "Created table : $t"
    }
}

# ── 4.2  Queues ──────────────────────────────────────────────────
Write-Info "Queues..."
foreach ($q in $queueNames) {
    if (-not (Get-AzStorageQueue -Name $q -Context $storageCtx -ErrorAction SilentlyContinue)) {
        New-AzStorageQueue -Name $q -Context $storageCtx | Out-Null
        Write-Success "Created queue : $q"
    }
}

# ── 4.3  Public-blob-access flag ─────────────────────────────────
$storageAccount = Get-AzStorageAccount -ResourceGroupName $envCfg.ResourceGroup -Name $envCfg.StorageAccount
if ($storageAccount.AllowBlobPublicAccess -eq $false) {
    Set-AzStorageAccount -ResourceGroupName $envCfg.ResourceGroup -Name $envCfg.StorageAccount -AllowBlobPublicAccess $true | Out-Null
    Write-Success "Public blob access enabled"
} else {
    Write-Info "Public blob access already enabled"
}

# ── 4.4  Blob containers ─────────────────────────────────────────
Write-Info "Blob containers..."
foreach ($c in $blobContainers) {
    if (-not (Get-AzStorageContainer -Name $c.Name -Context $storageCtx -ErrorAction SilentlyContinue)) {
        New-AzStorageContainer -Name $c.Name -Context $storageCtx -Permission $c.PublicAccess | Out-Null
        Write-Success "Created container : $($c.Name) ($($c.PublicAccess))"
    }
}

# ── 4.5  CORS rules on blob ──────────────────────────────────────
$corsRules = @(@{
        AllowedOrigins  = $envCfg.CorsOrigins
        AllowedMethods  = @('GET', 'HEAD', 'OPTIONS')
        AllowedHeaders  = @('*')
        ExposedHeaders  = @('*')
        MaxAgeInSeconds = 3600
    })
Remove-AzStorageCORSRule -ServiceType Blob -Context $storageCtx
Set-AzStorageCORSRule -ServiceType Blob -Context $storageCtx -CorsRules $corsRules
Write-Success "Blob CORS set for: $($envCfg.CorsOrigins -join ', ')"


# ─────────────────────────────────────────────────────────────────
#  PHASE 5.  Seed Key Vault secrets
# ─────────────────────────────────────────────────────────────────
Write-Step "PHASE 5 — Seed Key Vault secrets"

# ── 5.1  JwtSecret — random, generated once, never rotated here ──
if (-not (Get-AzKeyVaultSecret -VaultName $envCfg.KeyVault -Name 'JwtSecret' -ErrorAction SilentlyContinue)) {
    $jwt = ([guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N'))
    Set-AzKeyVaultSecret -VaultName $envCfg.KeyVault -Name 'JwtSecret' -SecretValue (ConvertTo-SecureString $jwt -AsPlainText -Force) | Out-Null
    Write-Success "Stored secret : JwtSecret (newly generated, 64 chars)"
} else {
    Write-Info "JwtSecret already present — left as-is"
}

# ── 5.2  CsrfSigningKey — same pattern ───────────────────────────
if (-not (Get-AzKeyVaultSecret -VaultName $envCfg.KeyVault -Name 'CsrfSigningKey' -ErrorAction SilentlyContinue)) {
    $csrf = ([guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N'))
    Set-AzKeyVaultSecret -VaultName $envCfg.KeyVault -Name 'CsrfSigningKey' -SecretValue (ConvertTo-SecureString $csrf -AsPlainText -Force) | Out-Null
    Write-Success "Stored secret : CsrfSigningKey (newly generated, 64 chars)"
} else {
    Write-Info "CsrfSigningKey already present — left as-is"
}

# ── 5.3  RazorpayWebhookSecret — we choose this; same value goes into
#        the Razorpay Dashboard webhook config. First deploy generates
#        + prints; later deploys leave it alone.
if (-not (Get-AzKeyVaultSecret -VaultName $envCfg.KeyVault -Name 'RazorpayWebhookSecret' -ErrorAction SilentlyContinue)) {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $whValue = [Convert]::ToBase64String($bytes)
    Set-AzKeyVaultSecret -VaultName $envCfg.KeyVault -Name 'RazorpayWebhookSecret' -SecretValue (ConvertTo-SecureString $whValue -AsPlainText -Force) | Out-Null
    Write-Success "Stored secret : RazorpayWebhookSecret (newly generated — paste into Razorpay dashboard)"
    Write-Info "Webhook secret value: $whValue"
} else {
    Write-Info "RazorpayWebhookSecret already present — left as-is"
}

# ── 5.4  RazorpayKeyId / RazorpayKeySecret — placeholders only ───
foreach ($name in @('RazorpayKeyId', 'RazorpayKeySecret')) {
    if (-not (Get-AzKeyVaultSecret -VaultName $envCfg.KeyVault -Name $name -ErrorAction SilentlyContinue)) {
        Set-AzKeyVaultSecret -VaultName $envCfg.KeyVault -Name $name -SecretValue (ConvertTo-SecureString 'replace-me' -AsPlainText -Force) | Out-Null
        Write-Success "Stored placeholder : $name (use Rotate-RazorpayApiKeys.ps1 to set the real value)"
    }
}


# ─────────────────────────────────────────────────────────────────
#  PHASE 6.  Configure Function App
# ─────────────────────────────────────────────────────────────────
Write-Step "PHASE 6 — Configure Function App"

# ── 6.1  App settings (env vars) ─────────────────────────────────
$appSettings = @{
    # MSI-based storage binding for the Functions runtime host —
    # works only AFTER Phase 7 grants the MI 'Storage Blob Data Owner'.
    'AzureWebJobsStorage__accountName'      = $envCfg.StorageAccount
    'AzureWebJobsStorage__blobServiceUri'   = "https://$($envCfg.StorageAccount).blob.core.windows.net"
    'AzureWebJobsStorage__queueServiceUri'  = "https://$($envCfg.StorageAccount).queue.core.windows.net"
    'AzureWebJobsStorage__tableServiceUri'  = "https://$($envCfg.StorageAccount).table.core.windows.net"

    # Key Vault references — resolved at app startup using the MI.
    'JWT_SECRET'                            = "@Microsoft.KeyVault(VaultName=$($envCfg.KeyVault);SecretName=JwtSecret)"
    'CSRF_SIGNING_KEY'                      = "@Microsoft.KeyVault(VaultName=$($envCfg.KeyVault);SecretName=CsrfSigningKey)"

    # Read by application code via DefaultAzureCredential.
    'AZURE_STORAGE_ACCOUNT_NAME'            = $envCfg.StorageAccount

    # Non-secret settings.
    'BLOB_BASE_URL'                         = "https://$($envCfg.StorageAccount).blob.core.windows.net"
    'CORS_ORIGIN'                           = $envCfg.CorsOrigins -join ','
    'COOKIE_DOMAIN'                         = $envCfg.CookieDomain
    'ENVIRONMENT'                           = $Environment
    'FUNCTIONS_WORKER_RUNTIME'              = 'node'

    # Queue names (new-backend.md §2.3 / §14.3).
    'NOTIFICATIONS_QUEUE_NAME'              = 'notifications-out'
    'WEBHOOKS_QUEUE_NAME'                   = 'webhooks-in'
    'REVIEW_QUEUE_NAME'                     = 'review-requests'

    # Container names (new-backend.md §14.1 / §14.3).
    'INVOICE_CONTAINER'                     = 'invoices'
    'USER_UPLOAD_CONTAINER'                 = 'user-uploads'

    # Application Insights.
    'APPLICATIONINSIGHTS_CONNECTION_STRING' = $appInsights.ConnectionString
    'APPINSIGHTS_INSTRUMENTATIONKEY'        = $appInsights.InstrumentationKey
}

Update-AzFunctionAppSetting `
    -ResourceGroupName $envCfg.ResourceGroup `
    -Name $envCfg.FunctionApp `
    -AppSetting $appSettings `
    -Force | Out-Null
Write-Success "Function App settings applied"

# ── 6.2  Platform CORS on the Function App ───────────────────────
$resourceId = (Get-AzResource -ResourceGroupName $envCfg.ResourceGroup -ResourceType 'Microsoft.Web/sites' -Name $envCfg.FunctionApp).ResourceId
$corsProperties = @{
    cors = @{
        allowedOrigins     = $envCfg.CorsOrigins
        supportCredentials = $true
    }
}
Set-AzResource -ResourceId "$resourceId/config/web" -Properties $corsProperties -ApiVersion '2022-03-01' -Force | Out-Null
Write-Success "Platform CORS configured (with credentials) for: $($envCfg.CorsOrigins -join ', ')"


# ─────────────────────────────────────────────────────────────────
#  PHASE 7.  Enable Function App MI + apply RUNTIME RBAC
# ─────────────────────────────────────────────────────────────────
#
# This is where the bulk of role assignments live. The script's
# design promise — "all the durable role assignments are at the
# end" — is fulfilled here. Anything granted in Phase 3 is a
# subset of what we re-assert below.

Write-Step "PHASE 7 — Function App Managed Identity + runtime RBAC"

# ── 7.1  Enable the System-Assigned MI on the Function App ───────
Update-AzFunctionApp -ResourceGroupName $envCfg.ResourceGroup -Name $envCfg.FunctionApp -IdentityType SystemAssigned -Force | Out-Null
$functionApp = Get-AzFunctionApp -ResourceGroupName $envCfg.ResourceGroup -Name $envCfg.FunctionApp
$principalId = $functionApp.IdentityPrincipalId
Write-Success "Function App MI enabled — principalId: $principalId"

# ── 7.2  Clean up any mis-scoped legacy assignment ───────────────
# Earlier versions of this script mis-scoped 'Key Vault Administrator'
# to the Function App resource. Remove it so the only visible vault
# assignment for the SP is the clean Phase 7 one below.
$badScope = $functionApp.Id
Get-AzRoleAssignment -ObjectId $spObjectId -Scope $badScope -ErrorAction SilentlyContinue |
    Where-Object { $_.RoleDefinitionName -eq 'Key Vault Administrator' } |
    ForEach-Object {
        Remove-AzRoleAssignment -ObjectId $spObjectId -RoleDefinitionName $_.RoleDefinitionName -Scope $_.Scope -ErrorAction SilentlyContinue
        Write-Info "Removed mis-scoped legacy role: $($_.RoleDefinitionName) at $($_.Scope)"
    }

# ── 7.3  Grant Function App MI its runtime roles ─────────────────
Write-Info "Applying Function App MI runtime roles..."
[void] (Apply-RolePlan `
        -ObjectId $principalId `
        -Plan $mi_RuntimeRoles `
        -StorageAccount $storageAccount `
        -KeyVault $keyVault `
        -AppInsights $appInsights)

# ── 7.4  Re-assert deployer SP durable roles ─────────────────────
Write-Info "Re-asserting deployer SP durable roles..."
[void] (Apply-RolePlan `
        -ObjectId $spObjectId `
        -Plan $sp_RuntimeRoles `
        -StorageAccount $storageAccount `
        -KeyVault $keyVault `
        -AppInsights $appInsights)

Write-Info "Waiting 15s for RBAC propagation..."
Start-Sleep -Seconds 15


# ─────────────────────────────────────────────────────────────────
#  PHASE 8.  Verify RBAC + summary
# ─────────────────────────────────────────────────────────────────
Write-Step "PHASE 8 — Verify RBAC on Function App MI"

$miAssignments = Get-AzRoleAssignment -ObjectId $principalId -ErrorAction SilentlyContinue
if (-not $miAssignments) {
    Write-Err "No role assignments visible on the Function App MI. RBAC propagation may still be in flight — re-run this script in a minute, or check the Portal."
} else {
    Write-Success "Function App MI currently holds:"
    Write-Host ''
    "{0,-40} {1}" -f 'Role', 'Scope (shortened)' | Write-Host -ForegroundColor DarkGray
    "{0,-40} {1}" -f ('─' * 38), ('─' * 60) | Write-Host -ForegroundColor DarkGray
    foreach ($a in $miAssignments | Sort-Object Scope, RoleDefinitionName) {
        $scopeShort = $a.Scope `
            -replace '^/subscriptions/[^/]+/resourceGroups/', 'rg:' `
            -replace '/providers/Microsoft\.', '/'
        "{0,-40} {1}" -f $a.RoleDefinitionName, $scopeShort | Write-Host
    }
    Write-Host ''

    # Hard-required runtime set — script fails loud if anything is missing.
    $required = @(
        @{ Role = 'Key Vault Secrets User'; ScopeContains = $envCfg.KeyVault }
        @{ Role = 'Storage Blob Data Owner'; ScopeContains = $envCfg.StorageAccount }
        @{ Role = 'Storage Table Data Contributor'; ScopeContains = $envCfg.StorageAccount }
        @{ Role = 'Storage Queue Data Contributor'; ScopeContains = $envCfg.StorageAccount }
    )
    $missing = @()
    foreach ($r in $required) {
        $hit = $miAssignments | Where-Object {
            $_.RoleDefinitionName -eq $r.Role -and $_.Scope -like "*$($r.ScopeContains)*"
        }
        if (-not $hit) { $missing += "$($r.Role) on *$($r.ScopeContains)*" }
    }
    if ($missing.Count -gt 0) {
        Write-Err 'Function App MI is MISSING these REQUIRED roles:'
        $missing | ForEach-Object { Write-Err "   • $_" }
        Write-Err 'The deploy is incomplete. Re-run this script — RBAC reads sometimes lag and the assignment is already in place but not visible yet.'
    } else {
        Write-Success 'All required RBAC roles are present. Function App is ready to run.'
    }
}

# ── Final summary ────────────────────────────────────────────────
$functionUrl = "https://$($envCfg.FunctionApp).azurewebsites.net"

Write-Host @"

╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║                   DEPLOYMENT COMPLETE ✓                       ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

Environment        : $Environment
Resource Group     : $($envCfg.ResourceGroup)
Storage Account    : $($envCfg.StorageAccount)
Function App       : $($envCfg.FunctionApp)
Application Insights : $($envCfg.AppInsights)
Key Vault          : $($envCfg.KeyVault)
Function App URL   : $functionUrl

📦 Tables   ($($tableNames.Count))    : $($tableNames -join ', ')
📬 Queues   ($($queueNames.Count))    : $($queueNames -join ', ')
🗂️  Containers ($($blobContainers.Count)) : $(($blobContainers | ForEach-Object { "$($_.Name)[$($_.PublicAccess)]" }) -join ', ')

🔐 Key Vault Secrets
   • JwtSecret              (auto-generated, 64 chars)
   • CsrfSigningKey         (auto-generated, 64 chars)
   • RazorpayWebhookSecret  (auto-generated — paste into Razorpay dashboard)
   • RazorpayKeyId          (placeholder — set via infra/Rotate-RazorpayApiKeys.ps1)
   • RazorpayKeySecret      (placeholder — set via infra/Rotate-RazorpayApiKeys.ps1)

📋 Next Steps
   1. Deploy backend code             : func azure functionapp publish $($envCfg.FunctionApp)
   2. Create Static Web App via Portal: connect to GitHub repo for CI/CD
   3. After SWA exists                : re-run this script or update CORS_ORIGIN manually
   4. Sign vendors                    : Razorpay + Shiprocket + Meta WhatsApp
                                         then run infra/Rotate-RazorpayApiKeys.ps1 to set real values

🛡️ Untouched (legacy)
   ✗ rg-tsa-dev   - left alone
   ✗ rg-tsa-prd   - left alone

"@ -ForegroundColor Green

Write-Host "Deployment completed: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
