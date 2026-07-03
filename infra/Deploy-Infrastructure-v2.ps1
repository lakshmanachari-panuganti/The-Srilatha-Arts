<#
.SYNOPSIS
    Deploy Azure Infrastructure for Srilatha Art (DEV or PRD).

.DESCRIPTION
    Creates and configures a complete environment for the Srilatha Art
    backend. Fully idempotent - re-runs are safe and only apply diffs.

    ── TABLE OF CONTENTS ─────────────────────────────────────────────
       PART A.  Script parameters + connection
       PART B.  Configuration (all environment values, in one place)
       PART C.  Helper functions
       PART D.  Execution (numbered phases)
         Phase 1  Prerequisites
         Phase 2  Create core resources
         Phase 3  Bootstrap SP RBAC (minimal - enables phases 4–6)
         Phase 4  Provision storage (tables, queues, blobs, CORS)
         Phase 5  Seed Key Vault secrets
         Phase 6  Configure Function App (app settings + CORS)
         Phase 7  Function App MI runtime RBAC
         Phase 8  Verify RBAC + summary
         Phase 9  GitHub Actions CI Service Principal (OIDC federated)
    ──────────────────────────────────────────────────────────────────

    Idempotency guarantees per phase:
      Phase 1   Checks only - no writes.
      Phase 2   Existence-check before every create. MI assign is
                skipped if the identity is already enabled.
                Key Vault RBAC-mode is validated on existing vaults.
                AppInsights ConnectionString + InstrumentationKey are
                always refreshed from a full GET if the resource exists.
      Phase 3   Role assignments are checked before write.
                RBAC propagation sleep is skipped if all roles already
                existed (no new assignments were made).
      Phase 4   Tables + queues + containers - existence check per item.
                Blob CORS - current rules are read and compared; the
                remove+set pair is only executed if they differ.
                Public-blob-access flag uses -ne $true (handles $null).
      Phase 5   Each KV secret checked before write.
      Phase 6   Existing Function App settings are read and merged in;
                no portal-added key is ever deleted.
                Function App CORS - read current, set only if different.
      Phase 7   Role assignments checked before write. RBAC propagation
                sleep is skipped when all roles already existed.
      Phase 8   Read-only verification pass.

    The role-assignment design (Phase 3 + Phase 7 combined):

      ▸ Deployer Service Principal
          • Key Vault Secrets Officer        → rotate secrets
          • Storage Blob Data Contributor    → read/write blobs
          • Storage Table Data Contributor   → seed / patch data
          • Storage Queue Data Contributor   → drain queues

      ▸ Function App System-Assigned Managed Identity
          • Key Vault Secrets User           → resolve KV refs
          • Storage Blob Data Owner          → identity-based
                                               AzureWebJobsStorage
          • Storage Table Data Contributor   → app data
          • Storage Queue Data Contributor   → queues
          • Monitoring Metrics Publisher     → App Insights

      ▸ GitHub Actions CI Service Principal
        (sp-github-actions-<slug>-<env>, federated via OIDC)
          • Website Contributor on Function App → az functionapp
            deployment source config-zip from the CI workflow,
            without a long-lived secret or publish profile.

    The script also REMOVES any legacy 'Key Vault Administrator'
    assignment that earlier versions mis-scoped to the Function App
    resource.

.PARAMETER Environment
    Target environment: DEV or PRD.

.EXAMPLE
    ./infra/Deploy-Infrastructure-v2.ps1 -Environment DEV

.NOTES
    Prerequisites
      - PowerShell 7+
      - Az module: Install-Module Az -Scope CurrentUser
        Sub-modules used: Az.Accounts, Az.Resources, Az.Storage,
        Az.KeyVault, Az.Websites, Az.ApplicationInsights
        (Az.Functions is deliberately NOT required - all Function App
        operations use az CLI to avoid the v4.3.2 GetRuntimeName bug)
      - Azure CLI (az) on PATH
      - Env vars MY_APPREG_CLIENT_ID / MY_APPREG_CLIENT_SECRET /
        MY_APPREG_TENANT_ID for an SP with on the subscription:
          Contributor + Key Vault Administrator + User Access
          Administrator (UAA is required to grant RBAC)

    Changes from v1:
      - Az.Functions removed from $requiredModules (never used; all FA
        ops go through az CLI).
      - Phase 2.3: AppInsights ConnectionString / InstrumentationKey
        explicitly fetched via full GET on existing resource.
      - Phase 2.5: Existing Key Vault validated for RBAC-mode; hard
        error if it is in Access Policy mode (would silently 403 later).
      - Phase 2.6: MI identity assign skipped when already enabled
        (no unnecessary API write on re-runs).
      - Phase 3 / 7: RBAC propagation sleep skipped when all roles
        already existed ($newlyAssigned = 0, no propagation needed).
      - Phase 4.3: AllowBlobPublicAccess check uses -ne $true
        (handles $null correctly; -eq $false was wrong for $null).
      - Phase 4.4: Existing containers now print "already exists"
        (was silent, gave no re-run visibility).
      - Phase 4.5: Blob CORS read-before-write comparison; the
        Remove + Set pair is only executed when rules differ (was
        unconditional on every run — caused a brief CORS outage window).
      - Phase 5.3: RandomNumberGenerator.Fill() (replaces deprecated
        RandomNumberGenerator.Create().GetBytes() pattern).
      - Phase 6.2: Function App CORS read-before-write; Set-AzResource
        only called when the current config differs from desired.
#>

# ═══════════════════════════════════════════════════════════════════
#  PART A.  Script parameters + connection
# ═══════════════════════════════════════════════════════════════════

[CmdletBinding()]
param(
    [Parameter()]
    [ValidateSet('DEV', 'PRD')]
    [string]$Environment = 'DEV',

    # Skip the interactive PRD confirmation prompt. Required when running
    # from CI / non-interactive PowerShell sessions. Assume the caller has
    # verified they intend to touch PRD.
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
& "$PSScriptRoot\Azure-Connectivity.ps1"

# ═══════════════════════════════════════════════════════════════════
#  PART B.  Configuration (all environment-dependent values here)
# ═══════════════════════════════════════════════════════════════════

$AppSlug = 'thesrilathaarts'

# ── B.1  Per-environment resource names ─────────────────────────────
$config = @{
    DEV = @{
        ResourceGroup  = "rg-$AppSlug-dev"
        Location       = "centralindia"
        StorageAccount = "st$($AppSlug)dev"
        FunctionApp    = "func-$AppSlug-dev"
        StaticWebApp   = "swa-$AppSlug-dev"
        KeyVault       = "kv-$AppSlug-dev"
        AppInsights    = "appi-$AppSlug-dev"
        CorsOrigins    = @(
            'http://localhost:3000',
            'https://delightful-mushroom-062e18100.7.azurestaticapps.net',
            # 2026-07-03 security assessment L5: unexplained external origin.
            # Not the DEV SWA host and not documented anywhere in the repo.
            # Leaving in place until the owner confirms it can be removed
            # (removal is a one-liner; add an entry back if a project breaks).
            'https://www.lucky1.online'
        )
        WebsiteUrl     = 'delightful-mushroom-062e18100.7.azurestaticapps.net'
    }
    PRD = @{
        ResourceGroup  = "rg-$AppSlug-prd"
        Location       = "centralindia"
        StorageAccount = "st$($AppSlug)prd"
        FunctionApp    = "func-$AppSlug-prd"
        StaticWebApp   = "swa-$AppSlug-prd"
        KeyVault       = "kv-$AppSlug-prd"
        AppInsights    = "appi-$AppSlug-prd"
        CorsOrigins    = @(
            'https://www.srilatha.art',
            'https://srilatha.art',
            'https://salmon-wave-01c7b8300.7.azurestaticapps.net'
        )
        WebsiteUrl     = 'www.srilatha.art'
    }
}
$envCfg = $config[$Environment]

# ── B.2  Storage tables ─────────────────────────────────────────────
$tableNames = @(
    'products', 'orders', 'orderItems', 'users', 'admins', 'config',
    'orderEvents', 'ordersByStatus',
    'coupons', 'couponRedemptions',
    'announcements',
    'wishlist', 'cart', 'reviews', 'customOrders',
    'newsletterSubscribers',
    'addresses', 'notifications',
    'staff', 'auditLog', 'rateLimits',
    'emailLogs', 'whatsappMessages', 'whatsappConversations'
)

# ── B.3  Storage queues ─────────────────────────────────────────────
$queueNames = @(
    'notifications-out',
    'webhooks-in',
    'review-requests'
)

# ── B.4  Blob containers ─────────────────────────────────────────────
$blobContainers = @(
    @{ Name = 'products'; PublicAccess = 'Blob' }
    @{ Name = 'categories'; PublicAccess = 'Blob' }
    @{ Name = 'assets'; PublicAccess = 'Blob' }
    @{ Name = 'branding'; PublicAccess = 'Blob' }   # logo for invoices / WhatsApp
    @{ Name = 'invoices'; PublicAccess = 'Off' }
    @{ Name = 'user-uploads'; PublicAccess = 'Off' }
)

# ── B.5  Required PowerShell modules ────────────────────────────────
# Az.Functions is deliberately absent — all Function App operations
# use az CLI to avoid the Az.Functions v4.3.2 GetRuntimeName.ContainsKey()
# null-key bug that crashes on Linux Consumption apps.
$requiredModules = @(
    'Az.Accounts', 'Az.Resources', 'Az.Storage', 'Az.KeyVault',
    'Az.Websites', 'Az.ApplicationInsights'
)

# ── B.6  RBAC role plan ─────────────────────────────────────────────
$sp_BootstrapRoles = @(
    @{ Resource = 'storage'; Role = 'Storage Blob Data Contributor'; Why = 'Create blob containers + CORS in Phase 4' }
    @{ Resource = 'storage'; Role = 'Storage Table Data Contributor'; Why = 'Create tables in Phase 4' }
    @{ Resource = 'storage'; Role = 'Storage Queue Data Contributor'; Why = 'Create queues in Phase 4' }
    @{ Resource = 'keyvault'; Role = 'Key Vault Secrets Officer'; Why = 'Write secrets in Phase 5' }
)

$sp_RuntimeRoles = @(
    @{ Resource = 'storage'; Role = 'Storage Blob Data Contributor'; Why = 'Deploy-time read/write of blobs' }
    @{ Resource = 'storage'; Role = 'Storage Table Data Contributor'; Why = 'Deploy-time data seed / patch' }
    @{ Resource = 'storage'; Role = 'Storage Queue Data Contributor'; Why = 'Deploy-time queue inspection / drain' }
    @{ Resource = 'keyvault'; Role = 'Key Vault Secrets Officer'; Why = 'Rotate secrets on subsequent runs' }
)

# Storage Blob Data OWNER (not Contributor) is required for the
# identity-based AzureWebJobsStorage connection — the Functions host
# needs Owner to manage internal state (lease blobs, locks, host secrets).
# Ref: https://learn.microsoft.com/azure/azure-functions/functions-reference#configure-an-identity-based-connection
$mi_RuntimeRoles = @(
    @{ Resource = 'keyvault'; Role = 'Key Vault Secrets User'; Why = 'Resolve @Microsoft.KeyVault(...) refs at startup' }
    @{ Resource = 'storage'; Role = 'Storage Blob Data Owner'; Why = 'Identity-based AzureWebJobsStorage - host internal state' }
    @{ Resource = 'storage'; Role = 'Storage Table Data Contributor'; Why = 'App data (orders, products, ...)' }
    @{ Resource = 'storage'; Role = 'Storage Queue Data Contributor'; Why = 'Notifications, webhook ingest, review request queues' }
    @{ Resource = 'appinsights'; Role = 'Monitoring Metrics Publisher'; Why = 'AAD-based AI telemetry path' }
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
function Write-Skip { param([string]$Message); Write-Host "  – $Message" -ForegroundColor DarkGray }

# Idempotent role assignment. Returns 'assigned' | 'existed' | 'failed'.
function Assign-AzRoleIfMissing {
    param(
        [Parameter(Mandatory)] [string]$ObjectId,
        [Parameter(Mandatory)] [string]$RoleDefinitionName,
        [Parameter(Mandatory)] [string]$Scope,
        [Parameter(Mandatory)] [string]$ScopeLabel
    )
    $existing = Get-AzRoleAssignment `
        -ObjectId           $ObjectId `
        -RoleDefinitionName $RoleDefinitionName `
        -Scope              $Scope `
        -ErrorAction        SilentlyContinue
    if ($existing) {
        Write-Skip "Already assigned : $RoleDefinitionName on $ScopeLabel"
        return 'existed'
    }
    try {
        New-AzRoleAssignment `
            -ObjectId           $ObjectId `
            -RoleDefinitionName $RoleDefinitionName `
            -Scope              $Scope `
            -ErrorAction        Stop | Out-Null
        Write-Success "Assigned         : $RoleDefinitionName on $ScopeLabel"
        return 'assigned'
    } catch {
        Write-Err "Could not assign : $RoleDefinitionName on $ScopeLabel - $($_.Exception.Message.Split([Environment]::NewLine)[0])"
        return 'failed'
    }
}

function Resolve-RoleScope {
    param(
        [Parameter(Mandatory)] [string]$ResourceKey,
        [Parameter(Mandatory)] $StorageAccount,
        [Parameter(Mandatory)] $KeyVault,
        [Parameter(Mandatory)] $AppInsights
    )
    switch ($ResourceKey) {
        'storage' { return @{ Id = $StorageAccount.Id; Label = "Storage  [$($StorageAccount.StorageAccountName)]" } }
        'keyvault' { return @{ Id = $KeyVault.ResourceId; Label = "KeyVault [$($KeyVault.VaultName)]" } }
        'appinsights' { return @{ Id = $AppInsights.Id; Label = "AppInsights [$($AppInsights.Name)]" } }
        default { throw "Unknown role-plan resource key: '$ResourceKey'" }
    }
}

# Returns count of newly-assigned roles (not counting 'existed' or 'failed').
# Callers use this to decide whether to wait for RBAC propagation.
function Apply-RolePlan {
    param(
        [Parameter(Mandatory)] [string]$ObjectId,
        [Parameter(Mandatory)] [object[]]$Plan,
        [Parameter(Mandatory)] $StorageAccount,
        [Parameter(Mandatory)] $KeyVault,
        [Parameter(Mandatory)] $AppInsights
    )
    $newCount = 0
    $failCount = 0
    foreach ($entry in $Plan) {
        $scope = Resolve-RoleScope `
            -ResourceKey    $entry.Resource `
            -StorageAccount $StorageAccount `
            -KeyVault       $KeyVault `
            -AppInsights    $AppInsights
        $result = Assign-AzRoleIfMissing `
            -ObjectId           $ObjectId `
            -RoleDefinitionName $entry.Role `
            -Scope              $scope.Id `
            -ScopeLabel         $scope.Label
        if ($result -eq 'assigned') { $newCount++ }
        if ($result -eq 'failed') { $failCount++ }
    }
    return @{ New = $newCount; Failed = $failCount }
}


# ═══════════════════════════════════════════════════════════════════
#  PART D.  Execution
# ═══════════════════════════════════════════════════════════════════

Write-Host @"

╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║       Srilatha Art - Infrastructure Deployment v2             ║
║       (Fully idempotent - safe to re-run)                     ║
║                                                               ║
║       Environment: $($Environment.PadRight(43))║
║       Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')                               ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Magenta

if ($Environment -eq 'PRD') {
    Write-Host "`n  ⚠  You are about to modify PRODUCTION infrastructure." -ForegroundColor Red
    if ($Force) {
        Write-Host "  -Force supplied - skipping interactive confirmation." -ForegroundColor Yellow
    } else {
        $confirm = Read-Host "  Type 'yes' to continue"
        if ($confirm -ne 'yes') { Write-Info "Aborted by operator."; exit 0 }
    }
}


# ─────────────────────────────────────────────────────────────────
#  PHASE 1.  Prerequisites
# ─────────────────────────────────────────────────────────────────
Write-Step "PHASE 1 - Prerequisites"

foreach ($mod in $requiredModules) {
    if (-not (Get-Module -ListAvailable -Name $mod)) {
        Write-Err "Missing module: $mod  →  Run: Install-Module Az -Scope CurrentUser"
        exit 1
    }
    Write-Success "Module available : $mod"
}

if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    Write-Err "Missing 'az' CLI on PATH  →  https://aka.ms/installazurecli"
    exit 1
}
Write-Success "az CLI available"

$context = Get-AzContext
if (-not $context) {
    Write-Err "Not logged in. Run: Connect-AzAccount"
    exit 1
}
Write-Success "Logged in as      : $($context.Account.Id)"
Write-Success "Subscription      : $($context.Subscription.Name) ($($context.Subscription.Id))"

# Pin az CLI to the same subscription as Az PowerShell so every
# az functionapp call targets the correct subscription.
az account set --subscription $context.Subscription.Id --output none
if ($LASTEXITCODE -ne 0) {
    Write-Err "Failed to pin az CLI to subscription $($context.Subscription.Id)."
    exit 1
}
Write-Success "az CLI sub pinned : $($context.Subscription.Id)"

foreach ($var in @('MY_APPREG_CLIENT_ID', 'MY_APPREG_CLIENT_SECRET', 'MY_APPREG_TENANT_ID')) {
    if ([string]::IsNullOrEmpty([System.Environment]::GetEnvironmentVariable($var))) {
        Write-Err "Required environment variable missing: $var"
        exit 1
    }
}
Write-Success "SP env vars       : all present"

$spObjectId = (Get-AzADServicePrincipal -ApplicationId $env:MY_APPREG_CLIENT_ID).Id
if (-not $spObjectId) {
    Write-Err "Could not resolve SP object ID for client ID '$env:MY_APPREG_CLIENT_ID'. Verify the app registration exists in this tenant."
    exit 1
}
Write-Success "Deployer SP       : $spObjectId"


# ─────────────────────────────────────────────────────────────────
#  PHASE 2.  Create core resources
# ─────────────────────────────────────────────────────────────────
Write-Step "PHASE 2 - Create core resources"

# ── 2.1  Resource Group ──────────────────────────────────────────
$rg = Get-AzResourceGroup -Name $envCfg.ResourceGroup -ErrorAction SilentlyContinue
if ($rg) {
    Write-Skip "Resource Group exists        : $($envCfg.ResourceGroup)"
} else {
    Write-Info "Creating Resource Group      : $($envCfg.ResourceGroup)"
    New-AzResourceGroup -Name $envCfg.ResourceGroup -Location $envCfg.Location -Tag @{
        project   = $AppSlug
        env       = $Environment.ToLower()
        managedBy = 'Deploy-Infrastructure-v2.ps1'
    } | Out-Null
    Write-Success "Resource Group created       : $($envCfg.ResourceGroup)"
}

# ── 2.2  Storage Account ─────────────────────────────────────────
$storageAccount = Get-AzStorageAccount `
    -ResourceGroupName $envCfg.ResourceGroup `
    -Name              $envCfg.StorageAccount `
    -ErrorAction       SilentlyContinue
if ($storageAccount) {
    Write-Skip "Storage Account exists       : $($envCfg.StorageAccount)"
} else {
    Write-Info "Creating Storage Account     : $($envCfg.StorageAccount)"
    $storageAccount = New-AzStorageAccount `
        -ResourceGroupName      $envCfg.ResourceGroup `
        -Name                   $envCfg.StorageAccount `
        -Location               $envCfg.Location `
        -SkuName                'Standard_LRS' `
        -Kind                   'StorageV2' `
        -AccessTier             'Hot' `
        -AllowBlobPublicAccess  $true `
        -EnableHttpsTrafficOnly $true
    Write-Success "Storage Account created      : $($envCfg.StorageAccount)"
}

# ── 2.3  Application Insights ────────────────────────────────────
# Always use a full GET so ConnectionString + InstrumentationKey are
# guaranteed populated whether the resource is new or existing.
# Get-AzApplicationInsights on an existing resource does return them,
# but we explicitly refresh in case of a stale object from a prior run.
$appInsights = Get-AzApplicationInsights `
    -ResourceGroupName $envCfg.ResourceGroup `
    -Name              $envCfg.AppInsights `
    -ErrorAction       SilentlyContinue
if ($appInsights) {
    Write-Skip "Application Insights exists  : $($envCfg.AppInsights)"
    # Re-fetch with full detail to guarantee ConnectionString is populated
    $appInsights = Get-AzApplicationInsights `
        -ResourceGroupName $envCfg.ResourceGroup `
        -Name              $envCfg.AppInsights
} else {
    Write-Info "Creating Application Insights: $($envCfg.AppInsights)"
    $appInsights = New-AzApplicationInsights `
        -ResourceGroupName $envCfg.ResourceGroup `
        -Name              $envCfg.AppInsights `
        -Location          $envCfg.Location `
        -Kind              'web' `
        -ApplicationType   'web'
    Write-Success "Application Insights created : $($envCfg.AppInsights)"
}
if (-not $appInsights.ConnectionString) {
    throw "Application Insights '$($envCfg.AppInsights)' has no ConnectionString. The resource may still be provisioning - wait 30s and re-run."
}

# ── 2.3a  Log Analytics workspace (Sec Phase 3 / M5) ─────────────
# Dedicated workspace in the env's own RG for Function App diagnostic
# logs. App Insights' own managed workspace lives in a locked "ai_..._managed"
# RG that carries a Microsoft-owned deny assignment, so we cannot write
# diagnostic settings there. A small workspace here is cheap and gives
# us KQL over FunctionAppLogs + AllMetrics.
$logAnalyticsName = "log-$AppSlug-$($Environment.ToLower())"
$logAnalytics = Get-AzOperationalInsightsWorkspace `
    -ResourceGroupName $envCfg.ResourceGroup `
    -Name              $logAnalyticsName `
    -ErrorAction       SilentlyContinue
if ($logAnalytics) {
    Write-Skip "Log Analytics workspace exists : $logAnalyticsName"
} else {
    Write-Info "Creating Log Analytics workspace: $logAnalyticsName"
    $logAnalytics = New-AzOperationalInsightsWorkspace `
        -ResourceGroupName $envCfg.ResourceGroup `
        -Name              $logAnalyticsName `
        -Location          $envCfg.Location `
        -Sku               'PerGB2018' `
        -RetentionInDays   30
    Write-Success "Log Analytics workspace created: $logAnalyticsName"
}

# ── 2.4  Function App (Linux Consumption, Node 22) ───────────────
# All Function App operations use az CLI.
# Az.Functions v4.3.2 has a GetRuntimeName.ContainsKey() null-key bug
# that crashes on Linux Consumption apps.
#
# az functionapp show exits 3 (ResourceNotFoundError) when the app
# does not exist. PS7.4+ $PSNativeCommandUseErrorActionPreference=$true
# (default) turns any non-zero exit into a terminating error under
# $ErrorActionPreference='Stop'. Toggle it off, check explicitly.
$functionApp = $null
$savedNativePref = $PSNativeCommandUseErrorActionPreference
$PSNativeCommandUseErrorActionPreference = $false
try {
    $functionAppJson = az functionapp show `
        --name           $envCfg.FunctionApp `
        --resource-group $envCfg.ResourceGroup `
        --output         json 2>$null
    $showExit = $LASTEXITCODE
} finally {
    $PSNativeCommandUseErrorActionPreference = $savedNativePref
}

if ($showExit -eq 0 -and $functionAppJson) {
    $functionApp = $functionAppJson | ConvertFrom-Json
    Write-Skip "Function App exists          : $($envCfg.FunctionApp)"
} elseif ($showExit -ne 0 -and $showExit -ne 3) {
    throw "az functionapp show exited with code $showExit - check subscription / RG access."
} else {
    Write-Info "Creating Function App        : $($envCfg.FunctionApp)"
    $functionAppJson = az functionapp create `
        --name                      $envCfg.FunctionApp `
        --resource-group            $envCfg.ResourceGroup `
        --storage-account           $envCfg.StorageAccount `
        --consumption-plan-location $envCfg.Location `
        --runtime                   node `
        --runtime-version           22 `
        --functions-version         4 `
        --os-type                   Linux `
        --app-insights              $envCfg.AppInsights `
        --output                    json
    if ($LASTEXITCODE -ne 0) { throw "Failed to create Function App via az CLI." }
    $functionApp = $functionAppJson | ConvertFrom-Json
    Write-Success "Function App created         : $($envCfg.FunctionApp)"
}

# ── 2.4a  Function App HTTPS-only enforcement (Sec Phase 1 / C1) ──
# Enforce HTTPS on the Function App: reject any HTTP request at the
# platform edge. Idempotent — checked before write. Applies to both
# DEV and PRD. Rollback: --set httpsOnly=false.
if ($functionApp.httpsOnly -eq $true) {
    Write-Skip "Function App httpsOnly       : already true"
} else {
    az functionapp update `
        --name           $envCfg.FunctionApp `
        --resource-group $envCfg.ResourceGroup `
        --set            httpsOnly=true `
        --output         none
    if ($LASTEXITCODE -ne 0) { throw "Failed to enable httpsOnly on Function App." }
    Write-Success "Function App httpsOnly       : enabled"
}

# ── 2.5  Key Vault ───────────────────────────────────────────────
$keyVault = Get-AzKeyVault `
    -ResourceGroupName $envCfg.ResourceGroup `
    -VaultName         $envCfg.KeyVault `
    -ErrorAction       SilentlyContinue
if ($keyVault) {
    Write-Skip "Key Vault exists             : $($envCfg.KeyVault)"
    # Validate RBAC mode on existing vault. If it was created in Access
    # Policy mode, all Key Vault Secrets Officer / Secrets User RBAC
    # assignments below are silently ignored on data-plane ops → 403.
    if (-not $keyVault.EnableRbacAuthorization) {
        Write-Err "Key Vault '$($envCfg.KeyVault)' is in Access Policy mode, not RBAC mode."
        Write-Err "RBAC role assignments (Secrets Officer / Secrets User) will be silently ignored."
        Write-Err "To fix: az keyvault update --name $($envCfg.KeyVault) --enable-rbac-authorization true"
        throw "Existing Key Vault is not in RBAC authorization mode. Fix it then re-run."
    }
    Write-Success "Key Vault RBAC mode          : confirmed"

    # ── 2.5a  KV purge protection (Sec Phase 2 / H3) ──────────────
    # Purge protection is IRREVERSIBLE once enabled. Applied to both
    # DEV and PRD so a deleted secret cannot be permanently wiped
    # inside the 90-day soft-delete window (would force JWT / CSRF /
    # invoice signing-key regeneration and log every user out).
    if ($keyVault.EnablePurgeProtection -eq $true) {
        Write-Skip "Key Vault purgeProtection   : already enabled"
    } else {
        az keyvault update `
            --name              $envCfg.KeyVault `
            --resource-group    $envCfg.ResourceGroup `
            --enable-purge-protection true `
            --output            none
        if ($LASTEXITCODE -ne 0) { throw "Failed to enable Key Vault purge protection." }
        Write-Success "Key Vault purgeProtection   : enabled (irreversible)"
    }
} else {
    Write-Info "Creating Key Vault           : $($envCfg.KeyVault)"
    $kvParams = @{
        Name                    = $envCfg.KeyVault
        ResourceGroupName       = $envCfg.ResourceGroup
        Location                = $envCfg.Location
        Sku                     = 'Standard'
        EnableRbacAuthorization = $true
        EnablePurgeProtection   = $true  # both envs (Sec Phase 2 / H3)
    }
    Write-Info "Purge protection enabled on Key Vault (irreversible)"
    $keyVault = New-AzKeyVault @kvParams
    Write-Success "Key Vault created            : $($envCfg.KeyVault)"
}

# ── 2.6  Function App System-Assigned Managed Identity ───────────
# az functionapp identity assign is safe to call unconditionally, but
# it triggers a needless API write on every re-run. Check first.
$identityJson = az functionapp identity show `
    --name           $envCfg.FunctionApp `
    --resource-group $envCfg.ResourceGroup `
    --output         json 2>$null
$existingIdentity = if ($identityJson) { $identityJson | ConvertFrom-Json } else { $null }

if ($existingIdentity -and $existingIdentity.principalId) {
    $principalId = $existingIdentity.principalId
    Write-Skip "Function App MI already enabled: principalId=$principalId"
} else {
    Write-Info "Enabling Function App Managed Identity..."
    $assignedJson = az functionapp identity assign `
        --name           $envCfg.FunctionApp `
        --resource-group $envCfg.ResourceGroup `
        --output         json
    if ($LASTEXITCODE -ne 0) { throw "Failed to enable Function App Managed Identity via az CLI." }
    $principalId = ($assignedJson | ConvertFrom-Json).principalId
    if (-not $principalId) {
        throw "principalId missing from 'az functionapp identity assign' output. Re-run in 30s."
    }
    Write-Success "Function App MI enabled      : principalId=$principalId"
}


# ─────────────────────────────────────────────────────────────────
#  PHASE 3.  Bootstrap deployer-SP RBAC
# ─────────────────────────────────────────────────────────────────
Write-Step "PHASE 3 - Bootstrap deployer-SP RBAC (data plane access)"

$bootstrapResult = Apply-RolePlan `
    -ObjectId       $spObjectId `
    -Plan           $sp_BootstrapRoles `
    -StorageAccount $storageAccount `
    -KeyVault       $keyVault `
    -AppInsights    $appInsights

if ($bootstrapResult.Failed -gt 0) {
    Write-Err "$($bootstrapResult.Failed) bootstrap role(s) failed to assign. Phases 4/5 may 403 - check SP permissions, then re-run."
}

# Only wait if new assignments were actually made. If all roles
# already existed, propagation already happened on a prior run.
if ($bootstrapResult.New -gt 0) {
    Write-Info "Waiting 30s for RBAC propagation ($($bootstrapResult.New) new assignment(s))..."
    Start-Sleep -Seconds 30
} else {
    Write-Skip "All bootstrap roles already existed - skipping propagation wait"
}

$storageCtx = New-AzStorageContext -StorageAccountName $envCfg.StorageAccount -UseConnectedAccount
Write-Success "Storage context ready (AAD-based)"


# ─────────────────────────────────────────────────────────────────
#  PHASE 4.  Provision storage
# ─────────────────────────────────────────────────────────────────
Write-Step "PHASE 4 - Provision storage"

# ── 4.1  Tables ──────────────────────────────────────────────────
Write-Info "Tables ($($tableNames.Count) desired)..."
$tablesCreated = 0
foreach ($t in $tableNames) {
    if (Get-AzStorageTable -Name $t -Context $storageCtx -ErrorAction SilentlyContinue) {
        Write-Skip "Table exists  : $t"
    } else {
        New-AzStorageTable -Name $t -Context $storageCtx | Out-Null
        Write-Success "Created table : $t"
        $tablesCreated++
    }
}
Write-Info "Tables: $tablesCreated created, $($tableNames.Count - $tablesCreated) already existed"

# ── 4.2  Queues ──────────────────────────────────────────────────
Write-Info "Queues ($($queueNames.Count) desired)..."
$queuesCreated = 0
foreach ($q in $queueNames) {
    if (Get-AzStorageQueue -Name $q -Context $storageCtx -ErrorAction SilentlyContinue) {
        Write-Skip "Queue exists  : $q"
    } else {
        New-AzStorageQueue -Name $q -Context $storageCtx | Out-Null
        Write-Success "Created queue : $q"
        $queuesCreated++
    }
}
Write-Info "Queues: $queuesCreated created, $($queueNames.Count - $queuesCreated) already existed"

# ── 4.3  Public blob access flag ─────────────────────────────────
# Re-read the storage account to get the current flag value.
# Use -ne $true (not -eq $false) — handles $null correctly.
$storageAccount = Get-AzStorageAccount `
    -ResourceGroupName $envCfg.ResourceGroup `
    -Name              $envCfg.StorageAccount
if ($storageAccount.AllowBlobPublicAccess -ne $true) {
    Set-AzStorageAccount `
        -ResourceGroupName    $envCfg.ResourceGroup `
        -Name                 $envCfg.StorageAccount `
        -AllowBlobPublicAccess $true | Out-Null
    Write-Success "Public blob access enabled"
} else {
    Write-Skip "Public blob access already enabled"
}

# ── 4.3a  Storage minimum TLS version (Sec Phase 1 / C2) ─────────
# Enforce TLS 1.2 as the minimum for all storage-account data plane
# traffic (blob, queue, table, file). Idempotent. Rollback:
# Set-AzStorageAccount -MinimumTlsVersion TLS1_0.
if ($storageAccount.MinimumTlsVersion -eq 'TLS1_2') {
    Write-Skip "Storage minimumTlsVersion    : already TLS1_2"
} else {
    Set-AzStorageAccount `
        -ResourceGroupName   $envCfg.ResourceGroup `
        -Name                $envCfg.StorageAccount `
        -MinimumTlsVersion   'TLS1_2' | Out-Null
    Write-Success "Storage minimumTlsVersion    : set to TLS1_2 (was $($storageAccount.MinimumTlsVersion))"
}

# ── 4.4  Blob containers ─────────────────────────────────────────
Write-Info "Blob containers ($($blobContainers.Count) desired)..."
$containersCreated = 0
foreach ($c in $blobContainers) {
    if (Get-AzStorageContainer -Name $c.Name -Context $storageCtx -ErrorAction SilentlyContinue) {
        Write-Skip "Container exists  : $($c.Name)  ($($c.PublicAccess))"
    } else {
        New-AzStorageContainer -Name $c.Name -Context $storageCtx -Permission $c.PublicAccess | Out-Null
        Write-Success "Created container : $($c.Name)  ($($c.PublicAccess))"
        $containersCreated++
    }
}
Write-Info "Containers: $containersCreated created, $($blobContainers.Count - $containersCreated) already existed"

# ── 4.5  Blob CORS rules ─────────────────────────────────────────
# Read existing rules before writing. Remove+Set every run (v1) caused
# a brief CORS outage window; now we only write when the config differs.
$desiredCors = @(@{
        AllowedOrigins  = $envCfg.CorsOrigins
        AllowedMethods  = @('GET', 'HEAD', 'OPTIONS')
        AllowedHeaders  = @('*')
        ExposedHeaders  = @('*')
        MaxAgeInSeconds = 3600
    })

$currentCorsRules = @(Get-AzStorageCORSRule -ServiceType Blob -Context $storageCtx -ErrorAction SilentlyContinue)
$currentOrigins = if ($currentCorsRules) { @($currentCorsRules[0].AllowedOrigins | Sort-Object) } else { @() }
$desiredOrigins = @($envCfg.CorsOrigins | Sort-Object)
$corsNeedsUpdate = ($currentCorsRules.Count -eq 0) -or
(Compare-Object $currentOrigins $desiredOrigins)

if ($corsNeedsUpdate) {
    Remove-AzStorageCORSRule -ServiceType Blob -Context $storageCtx
    Set-AzStorageCORSRule    -ServiceType Blob -Context $storageCtx -CorsRules $desiredCors
    Write-Success "Blob CORS updated for: $($envCfg.CorsOrigins -join ', ')"
} else {
    Write-Skip "Blob CORS already correct - no update needed"
}


# ─────────────────────────────────────────────────────────────────
#  PHASE 5.  Seed Key Vault secrets
# ─────────────────────────────────────────────────────────────────
Write-Step "PHASE 5 - Seed Key Vault secrets"

# ── 5.1  JwtSecret ───────────────────────────────────────────────
if (Get-AzKeyVaultSecret -VaultName $envCfg.KeyVault -Name 'JwtSecret' -ErrorAction SilentlyContinue) {
    Write-Skip "JwtSecret already present - left as-is"
} else {
    $jwt = ([guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N'))
    Set-AzKeyVaultSecret -VaultName $envCfg.KeyVault -Name 'JwtSecret' `
        -SecretValue (ConvertTo-SecureString $jwt -AsPlainText -Force) | Out-Null
    Write-Success "Stored secret : JwtSecret (newly generated, 64 chars)"
}

# ── 5.2  CsrfSigningKey ──────────────────────────────────────────
if (Get-AzKeyVaultSecret -VaultName $envCfg.KeyVault -Name 'CsrfSigningKey' -ErrorAction SilentlyContinue) {
    Write-Skip "CsrfSigningKey already present - left as-is"
} else {
    $csrf = ([guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N'))
    Set-AzKeyVaultSecret -VaultName $envCfg.KeyVault -Name 'CsrfSigningKey' `
        -SecretValue (ConvertTo-SecureString $csrf -AsPlainText -Force) | Out-Null
    Write-Success "Stored secret : CsrfSigningKey (newly generated, 64 chars)"
}

# ── 5.2b  InvoiceSigningKey ──────────────────────────────────────
# Signs the ?token= HMAC on public invoice URLs. Kept distinct from
# JwtSecret so a rotation triggered by an auth incident does not
# invalidate every invoice link already mailed / WhatsApp'd, and vice
# versa.
if (Get-AzKeyVaultSecret -VaultName $envCfg.KeyVault -Name 'InvoiceSigningKey' -ErrorAction SilentlyContinue) {
    Write-Skip "InvoiceSigningKey already present - left as-is"
} else {
    $invKey = ([guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N'))
    Set-AzKeyVaultSecret -VaultName $envCfg.KeyVault -Name 'InvoiceSigningKey' `
        -SecretValue (ConvertTo-SecureString $invKey -AsPlainText -Force) | Out-Null
    Write-Success "Stored secret : InvoiceSigningKey (newly generated, 64 chars)"
}

# ── 5.3  RazorpayWebhookSecret ───────────────────────────────────
# We choose this value; same string goes into the Razorpay Dashboard.
# First deploy generates + prints it; later deploys leave it alone.
if (Get-AzKeyVaultSecret -VaultName $envCfg.KeyVault -Name 'RazorpayWebhookSecret' -ErrorAction SilentlyContinue) {
    Write-Skip "RazorpayWebhookSecret already present - left as-is"
} else {
    # RandomNumberGenerator.Fill() replaces the deprecated Create().GetBytes() pattern
    $bytes = [byte[]]::new(32)
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    $whValue = [Convert]::ToBase64String($bytes)
    Set-AzKeyVaultSecret -VaultName $envCfg.KeyVault -Name 'RazorpayWebhookSecret' `
        -SecretValue (ConvertTo-SecureString $whValue -AsPlainText -Force) | Out-Null
    Write-Success "Stored secret : RazorpayWebhookSecret (newly generated - paste into Razorpay dashboard)"
    Write-Info "Webhook secret value: $whValue"
}

# ── 5.4  Razorpay key placeholders ───────────────────────────────
foreach ($name in @('RazorpayKeyId', 'RazorpayKeySecret')) {
    if (Get-AzKeyVaultSecret -VaultName $envCfg.KeyVault -Name $name -ErrorAction SilentlyContinue) {
        Write-Skip "$name already present - left as-is"
    } else {
        Set-AzKeyVaultSecret -VaultName $envCfg.KeyVault -Name $name `
            -SecretValue (ConvertTo-SecureString 'replace-me' -AsPlainText -Force) | Out-Null
        Write-Success "Stored placeholder : $name  (use Rotate-RazorpayApiKeys-v2.ps1 to set the real value)"
    }
}

# ── 5.5  Application Insights connection string (Sec Phase 2 / H1) ─
# Contains the Ingestion Key — treat as secret. Sourced from the App
# Insights resource we already fetched, so no operator paste needed.
# Refreshed every deploy in case the AI resource is rotated.
Set-AzKeyVaultSecret -VaultName $envCfg.KeyVault -Name 'ApplicationInsightsConnectionString' `
    -SecretValue (ConvertTo-SecureString $appInsights.ConnectionString -AsPlainText -Force) | Out-Null
Write-Success "Stored secret : ApplicationInsightsConnectionString (refreshed from AI resource)"

# ── 5.6  Operator-paste placeholders (Sec Phase 2 / H1) ──────────
# Third-party secrets migrated from inline app settings. Populated by
# infra\Migrate-SecretsToKeyVault.ps1 on the first Phase 2 rollout.
# Placeholders are seeded here so the @Microsoft.KeyVault(...) refs
# in the app settings block always resolve — even on a fresh env
# where the operator hasn't pasted real values yet.
$operatorSecretPlaceholders = @(
    'WhatsappAccessToken',
    'WhatsappAppSecret',
    'WhatsappWebhookVerifyToken',
    'WhatsappV2FunctionKey',
    'SmtpPass',
    'AzureOpenAIApiKey'
)
foreach ($name in $operatorSecretPlaceholders) {
    if (Get-AzKeyVaultSecret -VaultName $envCfg.KeyVault -Name $name -ErrorAction SilentlyContinue) {
        Write-Skip "$name already present - left as-is"
    } else {
        Set-AzKeyVaultSecret -VaultName $envCfg.KeyVault -Name $name `
            -SecretValue (ConvertTo-SecureString 'replace-me' -AsPlainText -Force) | Out-Null
        Write-Success "Stored placeholder : $name  (run Migrate-SecretsToKeyVault.ps1 or paste real value)"
    }
}



# ─────────────────────────────────────────────────────────────────
#  PHASE 6.  Configure Function App
# ─────────────────────────────────────────────────────────────────
Write-Step "PHASE 6 - Configure Function App"

# ── 6.1  App settings ────────────────────────────────────────────
#
# Three categories of keys (applied in order):
#
#   ALWAYS-OVERWRITE  — infra-derived values (storage URIs, KV refs,
#     AppInsights). Must track infra state on every run.
#
#   DEFAULT-IF-ABSENT — operator-tunable defaults (SMTP, WhatsApp
#     template language). Set on first deploy; left alone thereafter
#     so portal edits survive re-runs.
#
#   EMPTY-IF-ABSENT   — operator-pasted secrets. Added as empty
#     placeholders so the keys exist in the portal blade; never
#     overwrite a non-empty existing value.
#
# Strategy: read all existing settings first, merge into them locally,
# then send the full merged set. No existing key is ever deleted.

$existingJson = az functionapp config appsettings list `
    --name           $envCfg.FunctionApp `
    --resource-group $envCfg.ResourceGroup `
    --output         json
if ($LASTEXITCODE -ne 0) { throw "Failed to read existing Function App settings via az CLI." }

$mergedSettings = @{}
if ($existingJson) {
    foreach ($item in ($existingJson | ConvertFrom-Json)) {
        $mergedSettings[$item.name] = $item.value
    }
}

# ALWAYS-OVERWRITE
# All secret values live in Key Vault (Sec Phase 2 / H1). Run
# infra\Migrate-SecretsToKeyVault.ps1 first if seeding a new env — it
# copies the current inline values into KV under the canonical names
# referenced below before this script flips the app settings.
$alwaysOverwrite = @{
    'AzureWebJobsStorage__accountName'      = $envCfg.StorageAccount
    'AzureWebJobsStorage__blobServiceUri'   = "https://$($envCfg.StorageAccount).blob.core.windows.net"
    'AzureWebJobsStorage__queueServiceUri'  = "https://$($envCfg.StorageAccount).queue.core.windows.net"
    'AzureWebJobsStorage__tableServiceUri'  = "https://$($envCfg.StorageAccount).table.core.windows.net"
    # ── Cryptographic signing keys ────────────────────────────────
    'JWT_SECRET'                            = "@Microsoft.KeyVault(VaultName=$($envCfg.KeyVault);SecretName=JwtSecret)"
    'CSRF_SIGNING_KEY'                      = "@Microsoft.KeyVault(VaultName=$($envCfg.KeyVault);SecretName=CsrfSigningKey)"
    'INVOICE_SIGNING_KEY'                   = "@Microsoft.KeyVault(VaultName=$($envCfg.KeyVault);SecretName=InvoiceSigningKey)"
    # ── Third-party API secrets (Sec Phase 2 / H1) ────────────────
    'WHATSAPP_ACCESS_TOKEN'                 = "@Microsoft.KeyVault(VaultName=$($envCfg.KeyVault);SecretName=WhatsappAccessToken)"
    'WHATSAPP_APP_SECRET'                   = "@Microsoft.KeyVault(VaultName=$($envCfg.KeyVault);SecretName=WhatsappAppSecret)"
    'WHATSAPP_WEBHOOK_VERIFY_TOKEN'         = "@Microsoft.KeyVault(VaultName=$($envCfg.KeyVault);SecretName=WhatsappWebhookVerifyToken)"
    'WHATSAPP_V2_FUNCTION_KEY'              = "@Microsoft.KeyVault(VaultName=$($envCfg.KeyVault);SecretName=WhatsappV2FunctionKey)"
    'RAZORPAY_KEY_ID'                       = "@Microsoft.KeyVault(VaultName=$($envCfg.KeyVault);SecretName=RazorpayKeyId)"
    'RAZORPAY_KEY_SECRET'                   = "@Microsoft.KeyVault(VaultName=$($envCfg.KeyVault);SecretName=RazorpayKeySecret)"
    'RAZORPAY_WEBHOOK_SECRET'               = "@Microsoft.KeyVault(VaultName=$($envCfg.KeyVault);SecretName=RazorpayWebhookSecret)"
    'SMTP_PASS'                             = "@Microsoft.KeyVault(VaultName=$($envCfg.KeyVault);SecretName=SmtpPass)"
    'AZURE_OPENAI_API_KEY'                  = "@Microsoft.KeyVault(VaultName=$($envCfg.KeyVault);SecretName=AzureOpenAIApiKey)"
    # ── Non-secret infra values ───────────────────────────────────
    'AZURE_STORAGE_ACCOUNT_NAME'            = $envCfg.StorageAccount
    'BLOB_BASE_URL'                         = "https://$($envCfg.StorageAccount).blob.core.windows.net"
    'CORS_ORIGIN'                           = $envCfg.CorsOrigins -join ','
    'ENVIRONMENT'                           = $Environment
    'FUNCTIONS_WORKER_RUNTIME'              = 'node'
    'PUBLIC_SITE_URL'                       = "https://$($envCfg.WebsiteUrl)"
    'NOTIFICATIONS_QUEUE_NAME'              = 'notifications-out'
    'WEBHOOKS_QUEUE_NAME'                   = 'webhooks-in'
    'REVIEW_QUEUE_NAME'                     = 'review-requests'
    'INVOICE_CONTAINER'                     = 'invoices'
    'USER_UPLOAD_CONTAINER'                 = 'user-uploads'
    # Direct Function-App URL used to build the WhatsApp / email
    # "view invoice" link. Bypasses the SWA in front of
    # PUBLIC_SITE_URL, which on the Free tier cannot proxy /api/* to
    # the linked backend and silently returns the SPA's index.html —
    # which WhatsApp Cloud then caches as the "document".
    'INVOICE_PUBLIC_URL_BASE'               = "https://$($envCfg.FunctionApp).azurewebsites.net/api/invoices"
    # App Insights connection string is a secret (contains IngestionKey).
    # Written to KV in Phase 5.6 below so the reference always resolves,
    # even when Deploy-Infrastructure-v2.ps1 is run on a fresh env
    # before Migrate-SecretsToKeyVault.ps1.
    'APPLICATIONINSIGHTS_CONNECTION_STRING' = "@Microsoft.KeyVault(VaultName=$($envCfg.KeyVault);SecretName=ApplicationInsightsConnectionString)"
}
foreach ($k in $alwaysOverwrite.Keys) { $mergedSettings[$k] = $alwaysOverwrite[$k] }

# DEFAULT-IF-ABSENT
$defaultIfAbsent = @{
    'WHATSAPP_API_VERSION'       = 'v23.0'
    'WHATSAPP_TEMPLATE_LANGUAGE' = 'en_US'
    'SMTP_HOST'                  = 'smtp.gmail.com'
    'SMTP_PORT'                  = '587'
    'SMTP_SECURE'                = 'false'
    'SMTP_USER'                  = 'srilatha.art@gmail.com'
    'SMTP_SENDER_NAME'           = 'Srilatha Art'
    'SMTP_SENDER_EMAIL'          = 'srilatha.art@gmail.com'
    'SMTP_REPLY_TO'              = 'studio@srilatha.art'
}
foreach ($k in $defaultIfAbsent.Keys) {
    if (-not $mergedSettings.ContainsKey($k) -or [string]::IsNullOrEmpty($mergedSettings[$k])) {
        $mergedSettings[$k] = $defaultIfAbsent[$k]
    }
}

# EMPTY-IF-ABSENT (secrets migrated to KV in Phase 2 removed from this list)
$emptyIfAbsent = @(
    'INVOICE_LOGO_URL',
    'WHATSAPP_PHONE_NUMBER_ID',
    'WHATSAPP_WABA_ID'
)
foreach ($k in $emptyIfAbsent) {
    if (-not $mergedSettings.ContainsKey($k)) { $mergedSettings[$k] = '' }
}

# REMOVE — settings that are still present from older deploys but the
# app no longer reads. Plain dictionary removal here drops them from the
# locally merged set; the explicit `az config appsettings delete` below
# is what actually evicts them from the Function App. The merged-set
# pipe later in this script writes only the keys that survive merging,
# but Azure's PATCH semantics leave unmentioned keys in place — that
# is why deletion needs its own call.
$removeIfPresent = @(
    'COOKIE_DOMAIN',  # security audit 2026-06-07: cookies are host-only
                      # (azurewebsites.net vs srilatha.art is not a
                      # subdomain relationship; any Domain= we set is
                      # rejected by the browser per RFC 6265 §5.3).
    # CAPTCHA removed from the app entirely — clear the settings from any
    # environment that had them wired for the reCAPTCHA v3 experiment.
    'CAPTCHA_ENABLED',
    'RECAPTCHA_SECRET',
    'RECAPTCHA_SITE_KEY',
    'RECAPTCHA_SCORE_THRESHOLD',
    # Sec Phase 2 / H4 prep: shared-key storage conn string acts as a
    # backdoor around the MI-based AzureWebJobsStorage__* variants that
    # the app already uses. Removing it is a prerequisite for setting
    # allowSharedKeyAccess=false on the storage account.
    'AzureWebJobsStorage',
    # Sec Phase 2 / M6: legacy Functions dashboard, retired years ago.
    'AzureWebJobsDashboard',
    # Sec Phase 2 / M6: superseded by APPLICATIONINSIGHTS_CONNECTION_STRING;
    # keeping the plain IK encourages deprecated ingest path.
    'APPINSIGHTS_INSTRUMENTATIONKEY',
    # Sec Phase 2 / M6: not applicable on Linux Consumption FA.
    'WEBSITES_ENABLE_APP_SERVICE_STORAGE',
    # 2026-07-03 audit: stray FA app setting literally named 'slotSetting'
    # created by a mis-quoted `az functionapp config appsettings set` that
    # folded the 'slotSetting' JSON property name into a setting name.
    # Not read by any code path.
    'slotSetting'
)
$settingsToDelete = @()
foreach ($k in $removeIfPresent) {
    if ($mergedSettings.ContainsKey($k)) {
        $mergedSettings.Remove($k) | Out-Null
        $settingsToDelete += $k
    }
}
if ($settingsToDelete.Count -gt 0) {
    Write-Info "Removing obsolete app settings: $($settingsToDelete -join ', ')"
    az functionapp config appsettings delete `
        --name           $envCfg.FunctionApp `
        --resource-group $envCfg.ResourceGroup `
        --setting-names  $settingsToDelete `
        --output         none
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Failed to delete obsolete app settings - continuing with merge anyway."
    } else {
        Write-Success "Removed $($settingsToDelete.Count) obsolete app setting(s)."
    }
}

# Apply via ARM REST API (Invoke-AzRestMethod + JSON body).
#
# WHY NOT az functionapp config appsettings set --settings:
#   az CLI receives KEY=VALUE pairs as separate shell arguments.
#   On Windows, values that contain @, (, ), ; or embedded = signs —
#   such as @Microsoft.KeyVault(VaultName=kv-xxx;SecretName=JwtSecret)
#   — are mangled by the Windows argument parser before az CLI sees
#   them, producing a non-zero exit code.
#
# The ARM REST PUT replaces the full properties block, so we always
# send the complete merged set. Keys we did not touch are still
# included because $mergedSettings was seeded from the existing live
# settings at the top of Phase 6 — nothing is ever deleted.
$subId = $context.Subscription.Id
$putPath = "/subscriptions/$subId/resourceGroups/$($envCfg.ResourceGroup)" +
"/providers/Microsoft.Web/sites/$($envCfg.FunctionApp)" +
"/config/appsettings?api-version=2022-03-01"

$putBody = @{ properties = $mergedSettings } | ConvertTo-Json -Depth 5 -Compress

$putResponse = Invoke-AzRestMethod -Method PUT -Path $putPath -Payload $putBody

if ($putResponse.StatusCode -notin @(200, 201)) {
    throw "Failed to apply Function App settings via ARM REST (HTTP $($putResponse.StatusCode)): $($putResponse.Content)"
}
Write-Success "Function App settings applied ($($mergedSettings.Count) keys merged)"

# ── 6.2  Platform CORS on the Function App ───────────────────────
# Read the current CORS config before writing; only call Set-AzResource
# when the desired origins differ from the current ones.
$faResource = Get-AzResource `
    -ResourceGroupName $envCfg.ResourceGroup `
    -ResourceType      'Microsoft.Web/sites' `
    -Name              $envCfg.FunctionApp

$currentCorsConfig = (Get-AzResource `
        -ResourceId   "$($faResource.ResourceId)/config/web" `
        -ApiVersion   '2022-03-01' `
        -ErrorAction  SilentlyContinue).Properties.cors

$currentFaCorsOrigins = if ($currentCorsConfig -and $currentCorsConfig.allowedOrigins) {
    @($currentCorsConfig.allowedOrigins | Sort-Object)
} else { @() }
$desiredFaCorsOrigins = @($envCfg.CorsOrigins | Sort-Object)

$faCorsNeedsUpdate = $currentFaCorsOrigins.Count -eq 0 -or
(Compare-Object $currentFaCorsOrigins $desiredFaCorsOrigins)

if ($faCorsNeedsUpdate) {
    Set-AzResource `
        -ResourceId  "$($faResource.ResourceId)/config/web" `
        -Properties  @{ cors = @{ allowedOrigins = $envCfg.CorsOrigins; supportCredentials = $true } } `
        -ApiVersion  '2022-03-01' `
        -Force | Out-Null
    Write-Success "Function App CORS updated for: $($envCfg.CorsOrigins -join ', ')"
} else {
    Write-Skip "Function App CORS already correct - no update needed"
}

# ── 6.3  Diagnostic settings on Function App (Sec Phase 3 / M5) ──
# Stream FunctionAppLogs + AllMetrics into the dedicated Log Analytics
# workspace created in Phase 2.3a. Gives us KQL over auth events,
# throttling, and platform errors that survives outside the AI
# retention window.
$workspaceId = $logAnalytics.ResourceId
$desiredDiagName = 'send-to-workspace'
$faId = $faResource.ResourceId
$existingDiag = az monitor diagnostic-settings show `
    --name           $desiredDiagName `
    --resource       $faId `
    --output         json 2>$null
if ($LASTEXITCODE -eq 0 -and $existingDiag) {
    Write-Skip "Diagnostic settings           : '$desiredDiagName' already present"
} else {
    az monitor diagnostic-settings create `
        --name        $desiredDiagName `
        --resource    $faId `
        --workspace   $workspaceId `
        --logs        '[{\"categoryGroup\":\"allLogs\",\"enabled\":true}]' `
        --metrics     '[{\"category\":\"AllMetrics\",\"enabled\":true}]' `
        --output      none
    if ($LASTEXITCODE -ne 0) { throw "Failed to create diagnostic settings on Function App." }
    Write-Success "Diagnostic settings           : '$desiredDiagName' created → $($logAnalytics.Name)"
}

# ── 6.4  Application Insights disableLocalAuth (Sec Phase 3 / M4) ─
# BLOCKED pending code change. The `applicationinsights` v2.9 SDK in
# backend/src/utils/telemetry.ts calls `.setup(connectionString).start()`
# with no AAD credential, and the Azure Functions runtime auto-collect
# path also uses IK-based ingest. Setting DisableLocalAuth=true here on
# 2026-07-03 broke all AI ingest (0 requests, dependencies, exceptions
# reaching the workspace).
#
# Two prerequisites before we can flip this on:
#   1. Update telemetry.ts to pass `.setAADCredential(new DefaultAzureCredential())`
#      or migrate to `@azure/monitor-opentelemetry`.
#   2. Confirm the Functions Consumption-plan runtime honours the new
#      credential path (as of 2026, this is only fully supported on
#      the Flex Consumption / Premium tiers with specific host.json
#      config; on the classic Consumption plan the runtime request
#      collection may continue to use IK, forcing us to leave local
#      auth enabled).
#
# Once telemetry.ts is updated, re-enable this block and remove the guard.
Write-Skip "App Insights disableLocalAuth : deferred pending code change (see comment)"


# ─────────────────────────────────────────────────────────────────
#  PHASE 7.  Function App MI + runtime RBAC
# ─────────────────────────────────────────────────────────────────
Write-Step "PHASE 7 - Function App Managed Identity runtime RBAC"

Write-Success "Function App MI principalId : $principalId"

# Remove any mis-scoped legacy 'Key Vault Administrator' assignment
# that earlier versions of this script placed on the Function App resource.
Get-AzRoleAssignment -ObjectId $spObjectId -Scope $faResource.ResourceId -ErrorAction SilentlyContinue |
    Where-Object { $_.RoleDefinitionName -eq 'Key Vault Administrator' } |
    ForEach-Object {
        Remove-AzRoleAssignment `
            -ObjectId           $spObjectId `
            -RoleDefinitionName $_.RoleDefinitionName `
            -Scope              $_.Scope `
            -ErrorAction        SilentlyContinue
        Write-Info "Removed mis-scoped legacy role: $($_.RoleDefinitionName) at $($_.Scope)"
    }

# Grant the Function App MI its runtime roles
Write-Info "Applying Function App MI runtime roles..."
$miResult = Apply-RolePlan `
    -ObjectId       $principalId `
    -Plan           $mi_RuntimeRoles `
    -StorageAccount $storageAccount `
    -KeyVault       $keyVault `
    -AppInsights    $appInsights
if ($miResult.Failed -gt 0) {
    Write-Err "$($miResult.Failed) MI runtime role(s) failed - Function App may not start correctly. Check Phase 8."
}

# Re-assert deployer SP durable roles
Write-Info "Re-asserting deployer SP durable roles..."
$spResult = Apply-RolePlan `
    -ObjectId       $spObjectId `
    -Plan           $sp_RuntimeRoles `
    -StorageAccount $storageAccount `
    -KeyVault       $keyVault `
    -AppInsights    $appInsights
if ($spResult.Failed -gt 0) {
    Write-Err "$($spResult.Failed) SP runtime role(s) failed - secret rotation and deploy-time ops may fail."
}

# Only wait if new assignments were actually made this run.
$totalNew = $miResult.New + $spResult.New
if ($totalNew -gt 0) {
    Write-Info "Waiting 30s for RBAC propagation ($totalNew new assignment(s))..."
    Start-Sleep -Seconds 30
} else {
    Write-Skip "All MI + SP roles already existed - skipping propagation wait"
}


# ─────────────────────────────────────────────────────────────────
#  PHASE 8.  Verify RBAC + summary
# ─────────────────────────────────────────────────────────────────
Write-Step "PHASE 8 - Verify RBAC on Function App MI"

$miAssignments = Get-AzRoleAssignment -ObjectId $principalId -ErrorAction SilentlyContinue
if (-not $miAssignments) {
    Write-Err "No role assignments visible on the Function App MI. RBAC propagation may still be in flight - re-run this script in a minute, or check the Portal."
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
        Write-Err 'Re-run this script - RBAC reads sometimes lag even when the assignment already exists.'
    } else {
        Write-Success 'All required RBAC roles are present. Function App is ready to run.'
    }
}


# ─────────────────────────────────────────────────────────────────
#  PHASE 9.  GitHub Actions CI Service Principal (OIDC federated)
# ─────────────────────────────────────────────────────────────────
#
# Provisions a dedicated service principal used by the
# `Deploy Backend · {ENV}` GitHub Actions workflow to push the
# function code via:
#     az functionapp deployment source config-zip ...
#
# Auth flow: GitHub mints a short-lived OIDC token, presents it to
# Entra; Entra exchanges it for an AAD access token IF a matching
# federated credential exists on the app reg. No long-lived secret,
# no publish profile, no Kudu basic auth.
#
# Components per environment:
#   App Registration : sp-github-actions-<slug>-<env>
#   Service Principal: linked to the above in this tenant
#   Federated cred(s):
#     DEV  → repo:<owner>/<repo>:ref:refs/heads/develop
#     PRD  → repo:<owner>/<repo>:environment:production
#            (the prd workflow gates on a GitHub Environment, so
#             GitHub mints the token with the env-scoped sub claim;
#             branch-based subjects are NEVER presented in that mode)
#   RBAC : Website Contributor on the Function App resource
#          (minimal role for zipdeploy; avoids RG-wide Contributor)
#
# Prerequisites for the DEPLOYER SP running THIS script:
#   - Application.ReadWrite.OwnedBy (Graph) — to create the app reg.
#     Alternative: Application Administrator role in Entra.
#   - User Access Administrator (already a documented prereq) —
#     to grant Website Contributor in 9.4.

Write-Step "PHASE 9 - GitHub Actions CI Service Principal (OIDC)"

# 9.0  Repo + per-environment subject claims
$GitHubOwner = 'lakshmanachari-panuganti'
$GitHubRepo = 'The-Srilatha-Arts'
$ciSpName = "sp-github-actions-$AppSlug-$($Environment.ToLower())"

$federatedSubjects = if ($Environment -eq 'PRD') {
    @(@{
            Name    = 'github-actions-environment-production'
            Subject = "repo:$GitHubOwner/$GitHubRepo`:environment:production"
        })
} else {
    @(@{
            Name    = 'github-actions-develop'
            Subject = "repo:$GitHubOwner/$GitHubRepo`:ref:refs/heads/develop"
        })
}

# 9.1  App Registration
$ciAppRaw = az ad app list --display-name $ciSpName --query "[0]" --output json 2>$null
$ciAppExisted = -not [string]::IsNullOrWhiteSpace($ciAppRaw) -and $ciAppRaw -ne 'null'
if ($ciAppExisted) {
    $ciApp = $ciAppRaw | ConvertFrom-Json
    Write-Skip "App Registration exists  : $ciSpName"
} else {
    Write-Info "Creating App Registration: $ciSpName"
    az ad app create --display-name $ciSpName --sign-in-audience AzureADMyOrg --output none
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create app registration '$ciSpName'. The deployer SP needs Application.ReadWrite.OwnedBy on Microsoft Graph (or an Entra role such as Application Administrator)."
    }
    $ciApp = az ad app list --display-name $ciSpName --query "[0]" --output json | ConvertFrom-Json
    Write-Success "App Registration created : $ciSpName"
}

# 9.2  Service Principal
$ciSpRaw = az ad sp list --filter "appId eq '$($ciApp.appId)'" --query "[0]" --output json 2>$null
$ciSpExisted = -not [string]::IsNullOrWhiteSpace($ciSpRaw) -and $ciSpRaw -ne 'null'
if ($ciSpExisted) {
    $ciSp = $ciSpRaw | ConvertFrom-Json
    Write-Skip "Service Principal exists : $ciSpName"
} else {
    Write-Info "Creating Service Principal: $ciSpName"
    az ad sp create --id $ciApp.appId --output none
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create service principal for app '$ciSpName' (appId=$($ciApp.appId))."
    }
    $ciSp = az ad sp list --filter "appId eq '$($ciApp.appId)'" --query "[0]" --output json | ConvertFrom-Json
    Write-Success "Service Principal created: $ciSpName"
    # Newly-created SPs aren't immediately visible to RBAC reads in
    # some regions; tiny pause prevents a transient
    # "PrincipalNotFound" in Phase 9.4.
    Start-Sleep -Seconds 10
}

# 9.3  Federated credential(s)
$existingFedRaw = az ad app federated-credential list --id $ciApp.id --output json 2>$null
$existingFed = if ([string]::IsNullOrWhiteSpace($existingFedRaw)) { @() } else { $existingFedRaw | ConvertFrom-Json }

foreach ($fc in $federatedSubjects) {
    $match = $existingFed | Where-Object { $_.subject -eq $fc.Subject }
    if ($match) {
        Write-Skip "Federated credential exists: $($fc.Name) ($($fc.Subject))"
        continue
    }
    Write-Info "Adding federated credential : $($fc.Name)"
    $params = @{
        name      = $fc.Name
        issuer    = 'https://token.actions.githubusercontent.com'
        subject   = $fc.Subject
        audiences = @('api://AzureADTokenExchange')
    } | ConvertTo-Json -Compress
    az ad app federated-credential create --id $ciApp.id --parameters $params --output none
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to add federated credential '$($fc.Name)' on $ciSpName."
    }
    Write-Success "Federated credential added : $($fc.Name)"
}

# 9.4  RBAC: minimal role for zipdeploy on the Function App resource
$ciRoleOutcome = Assign-AzRoleIfMissing `
    -ObjectId           $ciSp.id `
    -RoleDefinitionName 'Website Contributor' `
    -Scope              $faResource.ResourceId `
    -ScopeLabel         "Function App [$($envCfg.FunctionApp)]"

# 9.5  Print the values to paste into GitHub repo secrets
$tenantId = $context.Tenant.Id
$subId = $context.Subscription.Id
$envUpper = $Environment.ToUpper()

Write-Host ''
Write-Host "  → Paste into GitHub repo Settings → Secrets and variables → Actions" -ForegroundColor Cyan
Write-Host "       AZURE_CLIENT_ID_$envUpper = $($ciApp.appId)" -ForegroundColor White
Write-Host "       AZURE_TENANT_ID        = $tenantId" -ForegroundColor White
Write-Host "       AZURE_SUBSCRIPTION_ID  = $subId" -ForegroundColor White
Write-Host ''


# ── Final summary ────────────────────────────────────────────────
$functionUrl = "https://$($envCfg.FunctionApp).azurewebsites.net"

Write-Host @"

╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║                   DEPLOYMENT COMPLETE ✓                       ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

Environment          : $Environment
Resource Group       : $($envCfg.ResourceGroup)
Storage Account      : $($envCfg.StorageAccount)
Function App         : $($envCfg.FunctionApp)
Application Insights : $($envCfg.AppInsights)
Key Vault            : $($envCfg.KeyVault)
Function App URL     : $functionUrl

📦 Tables      ($($tableNames.Count))     : $($tableNames -join ', ')
📬 Queues      ($($queueNames.Count))     : $($queueNames -join ', ')
🗂️  Containers ($($blobContainers.Count)) : $(($blobContainers | ForEach-Object { "$($_.Name)[$($_.PublicAccess)]" }) -join ', ')

🔐 Key Vault Secrets
   • JwtSecret              (auto-generated once, never overwritten on re-run)
   • CsrfSigningKey         (auto-generated once, never overwritten on re-run)
   • InvoiceSigningKey      (auto-generated once, never overwritten on re-run)
   • RazorpayWebhookSecret  (auto-generated once - paste into Razorpay dashboard)
   • RazorpayKeyId          (placeholder - set via infra/Rotate-RazorpayApiKeys-v2.ps1)
   • RazorpayKeySecret      (placeholder - set via infra/Rotate-RazorpayApiKeys-v2.ps1)

📋 Next Steps
   1. Deploy backend code             : func azure functionapp publish $($envCfg.FunctionApp)
   2. Create Static Web App via Portal: connect to GitHub repo for CI/CD
   3. After SWA exists                : re-run this script or update CORS_ORIGIN manually
   4. Sign vendors                    : Razorpay + Shiprocket + Meta WhatsApp
                                        then run infra/Rotate-RazorpayApiKeys-v2.ps1

🛡️ Untouched (legacy)
   ✗ rg-tsa-dev   - left alone
   ✗ rg-tsa-prd   - left alone

"@ -ForegroundColor Green

Write-Host "Deployment completed: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan

# ── Empty app settings ───────────────────────────────────────────
# Read the live settings back and list every key whose value is empty
# so the operator knows exactly what still needs to be filled in.
$liveJson = az functionapp config appsettings list `
    --name           $envCfg.FunctionApp `
    --resource-group $envCfg.ResourceGroup `
    --output         json 2>$null

$emptyKeys = @(if ($liveJson) {
        ($liveJson | ConvertFrom-Json) |
            Where-Object { [string]::IsNullOrEmpty($_.value) } |
            Select-Object -ExpandProperty name |
            Sort-Object
    })

if ($emptyKeys.Count -gt 0) {
    Write-Host ''
    Write-Host "  ⚠  $($emptyKeys.Count) app setting(s) with empty values — operator action required:" -ForegroundColor Yellow
    foreach ($key in $emptyKeys) {
        Write-Host "       • $key" -ForegroundColor Yellow
    }
    Write-Host ''
} else {
    Write-Host ''
    Write-Host "  ✓ All app settings have values." -ForegroundColor Green
    Write-Host ''
}
