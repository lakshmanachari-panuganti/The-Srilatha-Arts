<#
.SYNOPSIS
    Deploy Azure Infrastructure for Srilatha Art (DEV or PRD).

.DESCRIPTION
    Creates and configures a complete environment for the Srilatha Art
    backend. Idempotent - re-runs are safe and only apply diffs.

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
         Phase 7  Enable Function App MI + apply RUNTIME RBAC ⬅ all
                  durable role assignments live here, at the end
         Phase 8  Verify RBAC + summary
    ────────────────────────────────────────────────────────────────────

    The role-assignment design (Phase 3 + Phase 7 combined):

      ▸ Deployer Service Principal - used by this script and the
        GitHub Actions deploy workflows. Roles:
          • Key Vault Secrets Officer        → rotate secrets
          • Storage Blob Data Contributor    → read/write product
                                                images + invoices
          • Storage Table Data Contributor   → seed / patch data
          • Storage Queue Data Contributor   → drain queues at deploy

      ▸ Function App System-Assigned Managed Identity - used at
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
& "$PSScriptRoot\Azure-Connectivity.ps1"
# ═══════════════════════════════════════════════════════════════════
#  PART B.  Configuration (all environment-dependent values here)
# ═══════════════════════════════════════════════════════════════════
#
# Everything below is data only - no side effects. Edit values here,
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
    'wishlist', 'cart', 'reviews', 'customOrders',
    'newsletterSubscribers',
    'addresses', 'notifications',
    'staff', 'auditLog', 'rateLimits',
    # Notification + WhatsApp tables (added 2026-06-04). emailLogs
    # holds per-attempt SMTP delivery logs; whatsappMessages /
    # whatsappConversations back the admin Conversation Center.
    'emailLogs', 'whatsappMessages', 'whatsappConversations'
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
    # Public so the WhatsApp Cloud API + email clients can fetch the
    # letterhead logo referenced by INVOICE_LOGO_URL without auth.
    @{ Name = 'branding'; PublicAccess = 'Blob' }
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
# split across Phase 3 (bootstrap - minimum to make the rest of the
# script work) and Phase 7 (runtime - the bulk).
#
# Note: $sp_BootstrapRoles is what THIS script needs in order to
# perform later data-plane operations against Storage and Key
# Vault. $sp_RuntimeRoles is the same SP's enduring assignments -
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
    # Same as bootstrap - re-asserted at the end for the durable
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
# identity-based AzureWebJobsStorage connection - the Functions host
# needs Owner to manage internal state (lease blobs, host secrets,
# distributed locks for queue/timer triggers).
# Ref: https://learn.microsoft.com/azure/azure-functions/functions-reference#configure-an-identity-based-connection
$mi_RuntimeRoles = @(
    @{ Resource = 'keyvault'; Role = 'Key Vault Secrets User'; Why = 'Resolve @Microsoft.KeyVault(...) refs at startup' }
    @{ Resource = 'storage'; Role = 'Storage Blob Data Owner'; Why = 'Identity-based AzureWebJobsStorage - host internal state' }
    @{ Resource = 'storage'; Role = 'Storage Table Data Contributor'; Why = 'App data (orders, products, ...)' }
    @{ Resource = 'storage'; Role = 'Storage Queue Data Contributor'; Why = 'Notifications, webhook ingest, review request queues' }
    @{ Resource = 'appinsights'; Role = 'Monitoring Metrics Publisher'; Why = 'Forward-looking - AAD-based AI telemetry path' }
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
# throws - callers decide whether a miss is fatal.
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
        Write-Err "Could not assign : $RoleDefinitionName on $ScopeLabel - $($_.Exception.Message.Split([Environment]::NewLine)[0])"
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

# Apply a list of (Principal, Resource, Role) tuples. Used twice - once
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

# BUG4: Require explicit confirmation before touching production.
if ($Environment -eq 'PRD') {
    Write-Host "`n  ⚠  You are about to modify PRODUCTION infrastructure." -ForegroundColor Red
    $confirm = Read-Host "  Type 'yes' to continue"
    if ($confirm -ne 'yes') { Write-Info "Aborted by operator."; exit 0 }
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
    Write-Success "Module available: $mod"
}

# az CLI is required for the Phase 6.1 Function App settings I/O
# workaround (see the connection block at the top of the script).
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
Write-Success "Logged in as  : $($context.Account.Id)"
Write-Success "Subscription  : $($context.Subscription.Name) ($($context.Subscription.Id))"

# Pin the az CLI session to the SAME subscription as Az PowerShell.
# Otherwise az defaults to whatever the SP's first subscription is,
# which may not be where the resources live - causing every
# `az functionapp show / config / identity` call to miss with
# ResourceNotFound and the script to wrongly fall through to create.
az account set --subscription $context.Subscription.Id --output none
if ($LASTEXITCODE -ne 0) {
    Write-Err "Failed to pin az CLI to subscription $($context.Subscription.Id)."
    exit 1
}
Write-Success "az CLI sub set: $($context.Subscription.Id)"

# BUG2: Validate required SP environment variables before any Az calls.
# Missing vars cause cryptic null-reference errors deep in Phase 3 under
# Set-StrictMode -Version Latest.
foreach ($var in @('MY_APPREG_CLIENT_ID', 'MY_APPREG_CLIENT_SECRET', 'MY_APPREG_TENANT_ID')) {
    if ([string]::IsNullOrEmpty([System.Environment]::GetEnvironmentVariable($var))) {
        Write-Err "Required environment variable missing: $var"
        exit 1
    }
}
Write-Success "SP env vars   : all present (MY_APPREG_CLIENT_ID, MY_APPREG_CLIENT_SECRET, MY_APPREG_TENANT_ID)"

# Resolve the deployer SP's object id once - used by both Phase 3 and
# Phase 7. The Get-Az call requires Directory.Read for the SP itself,
# which the env-var SP has implicitly as a directory member.
$spObjectId = (Get-AzADServicePrincipal -ApplicationId $env:MY_APPREG_CLIENT_ID).Id
if (-not $spObjectId) {
    Write-Err "Could not resolve SP object ID for client ID: $env:MY_APPREG_CLIENT_ID - verify the app registration exists in this tenant."
    exit 1
}
Write-Success "Deployer SP   : $spObjectId"


# ─────────────────────────────────────────────────────────────────
#  PHASE 2.  Create core resources (no RBAC yet)
# ─────────────────────────────────────────────────────────────────
Write-Step "PHASE 2 - Create core resources"

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
#       Done via az CLI - Get/New/Update-AzFunctionApp in
#       Az.Functions v4.3.2 all hit the GetRuntimeName.ContainsKey()
#       null-key bug on Linux Consumption apps (see top of file).
#
#       `az functionapp show` exits 3 (ResourceNotFoundError) when
#       the app doesn't exist. PowerShell 7.4+'s
#       $PSNativeCommandUseErrorActionPreference (default $true) would
#       turn that into a terminating error under our
#       $ErrorActionPreference='Stop' setting, so we toggle it off
#       around the call. After the call we explicitly distinguish:
#         exit 0  → exists, parse JSON
#         exit 3  → not found, fall through to create
#         other   → real error, surface it loudly
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
} elseif ($showExit -ne 0 -and $showExit -ne 3) {
    throw "az functionapp show exited with code $showExit - check subscription / RG access."
}

if ($functionApp) {
    Write-Success "Function App exists         : $($envCfg.FunctionApp)"
} else {
    Write-Info "Creating Function App       : $($envCfg.FunctionApp)"
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
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create Function App via az CLI."
    }
    $functionApp = $functionAppJson | ConvertFrom-Json
    Write-Success "Function App created        : $($envCfg.FunctionApp)"
}

# ── 2.5  Key Vault (RBAC auth mode, single vault for app + backups) ─
$keyVault = Get-AzKeyVault -ResourceGroupName $envCfg.ResourceGroup -VaultName $envCfg.KeyVault -ErrorAction SilentlyContinue
if ($keyVault) {
    Write-Success "Key Vault exists            : $($envCfg.KeyVault)"
} else {
    Write-Info "Creating Key Vault          : $($envCfg.KeyVault)"
    # BUG1: Must create in RBAC authorization mode, not the default
    # Vault Access Policy mode. All role assignments in this script
    # (Key Vault Secrets Officer / Key Vault Secrets User) are RBAC
    # assignments and are silently ignored on access-policy vaults.
    # M3: Enable purge protection for PRD (one-way door - prevents
    # accidental permanent deletion of secrets).
    $kvParams = @{
        Name                    = $envCfg.KeyVault
        ResourceGroupName       = $envCfg.ResourceGroup
        Location                = $envCfg.Location
        Sku                     = 'Standard'
        EnableRbacAuthorization = $true
    }
    if ($Environment -eq 'PRD') {
        $kvParams['EnablePurgeProtection'] = $true
        Write-Info "PRD: purge protection enabled on Key Vault"
    }
    $keyVault = New-AzKeyVault @kvParams
    Write-Success "Key Vault created           : $($envCfg.KeyVault)"
}

# ── 2.6  Enable Function App System-Assigned Managed Identity ────
# BUG3 / M5: Enabled HERE (before Phase 6 settings and any code
# deployment) so the MI exists as soon as the app does. If code is
# deployed between Phase 6 and Phase 7, the KV refs will already
# resolve correctly. az functionapp identity assign is idempotent -
# safe on an app that already has an MI; returns the existing id.
Write-Info "Enabling Function App System-Assigned Managed Identity..."
$identityJson = az functionapp identity assign `
    --name           $envCfg.FunctionApp `
    --resource-group $envCfg.ResourceGroup `
    --output         json
if ($LASTEXITCODE -ne 0) {
    throw "Failed to enable Function App Managed Identity via az CLI."
}
$principalId = ($identityJson | ConvertFrom-Json).principalId
if (-not $principalId) {
    throw "principalId missing from 'az functionapp identity assign' output. Re-run in 30s if the MI was just created."
}
Write-Success "Function App MI enabled     : principalId=$principalId"


# ─────────────────────────────────────────────────────────────────
#  PHASE 3.  Bootstrap deployer-SP RBAC
# ─────────────────────────────────────────────────────────────────
#
# Just enough for the deployer SP to perform the data-plane
# operations in Phases 4 + 5 of THIS script. The same SP roles are
# re-asserted in Phase 7 as part of the durable role plan - that's
# intentional (idempotent), so the long-term documented set lives
# in one place near the end.

Write-Step "PHASE 3 - Bootstrap deployer-SP RBAC (data plane access)"

# M6: capture count so a partial failure is surfaced loudly rather
# than silently swallowed - callers own the fatality decision.
$bootstrapOk = Apply-RolePlan `
    -ObjectId       $spObjectId `
    -Plan           $sp_BootstrapRoles `
    -StorageAccount $storageAccount `
    -KeyVault       $keyVault `
    -AppInsights    $appInsights
if ($bootstrapOk -lt $sp_BootstrapRoles.Count) {
    Write-Err "Only $bootstrapOk / $($sp_BootstrapRoles.Count) bootstrap roles assigned. Phases 4/5 may 403 - check SP permissions, then re-run."
}

Write-Info "Waiting 30s for RBAC propagation before data-plane ops..."
Start-Sleep -Seconds 30

# Storage context - AAD-based, no shared keys. This call validates
# the bootstrap RBAC above; if it fails the next phases would
# silently produce 403s.
$storageCtx = New-AzStorageContext -StorageAccountName $envCfg.StorageAccount -UseConnectedAccount
Write-Success "Storage context ready (AAD-based)"


# ─────────────────────────────────────────────────────────────────
#  PHASE 4.  Provision storage (tables, queues, blob containers, CORS)
# ─────────────────────────────────────────────────────────────────
Write-Step "PHASE 4 - Provision storage"

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
Write-Step "PHASE 5 - Seed Key Vault secrets"

# ── 5.1  JwtSecret - random, generated once, never rotated here ──
if (-not (Get-AzKeyVaultSecret -VaultName $envCfg.KeyVault -Name 'JwtSecret' -ErrorAction SilentlyContinue)) {
    $jwt = ([guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N'))
    Set-AzKeyVaultSecret -VaultName $envCfg.KeyVault -Name 'JwtSecret' -SecretValue (ConvertTo-SecureString $jwt -AsPlainText -Force) | Out-Null
    Write-Success "Stored secret : JwtSecret (newly generated, 64 chars)"
} else {
    Write-Info "JwtSecret already present - left as-is"
}

# ── 5.2  CsrfSigningKey - same pattern ───────────────────────────
if (-not (Get-AzKeyVaultSecret -VaultName $envCfg.KeyVault -Name 'CsrfSigningKey' -ErrorAction SilentlyContinue)) {
    $csrf = ([guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N'))
    Set-AzKeyVaultSecret -VaultName $envCfg.KeyVault -Name 'CsrfSigningKey' -SecretValue (ConvertTo-SecureString $csrf -AsPlainText -Force) | Out-Null
    Write-Success "Stored secret : CsrfSigningKey (newly generated, 64 chars)"
} else {
    Write-Info "CsrfSigningKey already present - left as-is"
}

# ── 5.2b InvoiceSigningKey - HMAC key for public invoice ?token=.
#        Distinct from JwtSecret so an auth-incident rotation does not
#        invalidate every invoice link already mailed / WhatsApp'd.
if (-not (Get-AzKeyVaultSecret -VaultName $envCfg.KeyVault -Name 'InvoiceSigningKey' -ErrorAction SilentlyContinue)) {
    $invKey = ([guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N'))
    Set-AzKeyVaultSecret -VaultName $envCfg.KeyVault -Name 'InvoiceSigningKey' -SecretValue (ConvertTo-SecureString $invKey -AsPlainText -Force) | Out-Null
    Write-Success "Stored secret : InvoiceSigningKey (newly generated, 64 chars)"
} else {
    Write-Info "InvoiceSigningKey already present - left as-is"
}

# ── 5.3  RazorpayWebhookSecret - we choose this; same value goes into
#        the Razorpay Dashboard webhook config. First deploy generates
#        + prints; later deploys leave it alone.
if (-not (Get-AzKeyVaultSecret -VaultName $envCfg.KeyVault -Name 'RazorpayWebhookSecret' -ErrorAction SilentlyContinue)) {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $whValue = [Convert]::ToBase64String($bytes)
    Set-AzKeyVaultSecret -VaultName $envCfg.KeyVault -Name 'RazorpayWebhookSecret' -SecretValue (ConvertTo-SecureString $whValue -AsPlainText -Force) | Out-Null
    Write-Success "Stored secret : RazorpayWebhookSecret (newly generated - paste into Razorpay dashboard)"
    Write-Info "Webhook secret value: $whValue"
} else {
    Write-Info "RazorpayWebhookSecret already present - left as-is"
}

# ── 5.4  RazorpayKeyId / RazorpayKeySecret - placeholders only ───
foreach ($name in @('RazorpayKeyId', 'RazorpayKeySecret')) {
    if (-not (Get-AzKeyVaultSecret -VaultName $envCfg.KeyVault -Name $name -ErrorAction SilentlyContinue)) {
        Set-AzKeyVaultSecret -VaultName $envCfg.KeyVault -Name $name -SecretValue (ConvertTo-SecureString 'replace-me' -AsPlainText -Force) | Out-Null
        Write-Success "Stored placeholder : $name (use Rotate-RazorpayApiKeys.ps1 to set the real value)"
    }
}


# ─────────────────────────────────────────────────────────────────
#  PHASE 6.  Configure Function App
# ─────────────────────────────────────────────────────────────────
Write-Step "PHASE 6 - Configure Function App"

# ── 6.1  App settings (env vars) ─────────────────────────────────
#
# Strategy: Update-AzFunctionAppSetting replaces the app settings
# collection with the hashtable it's given. To guarantee we never
# delete a setting the operator added in the portal (or a value they
# pasted in for a secret), we ALWAYS read the current settings first
# and merge into them locally. The cmdlet then receives the full
# desired state, eliminating any reliance on its implicit merge
# behaviour.
#
# Three categories of keys:
#
#   1. ALWAYS-OVERWRITE  - derived from $envCfg / fixed constants
#      (storage URIs, KV refs, queue names, AppInsights). These must
#      track infra state on every run.
#
#   2. DEFAULT-IF-ABSENT - sensible defaults that an operator might
#      reasonably tune per environment (template language, SMTP
#      host/port, sender name, etc). Set on first deploy; left alone
#      on later runs so portal edits survive.
#
#   3. EMPTY-IF-ABSENT   - real secrets and operator-supplied tokens.
#      Initialise as empty placeholders so the keys exist in the
#      portal blade for the operator to paste real values into, but
#      never overwrite a non-empty existing value.

# ── 1. Read existing settings (via az CLI) ──────────────────────
#       Get-AzFunctionAppSetting in Az.Functions v4.3.2 throws
#       'Value cannot be null. (Parameter "key")' inside
#       GetRuntimeName.ContainsKey() on Linux Consumption Function
#       Apps. `az` is unaffected, so we shell out for this single
#       read. Format: an array of {name, value, slotSetting} objects.
$existingJson = az functionapp config appsettings list `
    --name           $envCfg.FunctionApp `
    --resource-group $envCfg.ResourceGroup `
    --output         json
if ($LASTEXITCODE -ne 0) {
    throw "Failed to read existing Function App settings via az CLI."
}
$existingSettings = @{}
if ($existingJson) {
    foreach ($item in ($existingJson | ConvertFrom-Json)) {
        $existingSettings[$item.name] = $item.value
    }
}

# ── 2. Start the merged hashtable from existing state ────────────
$mergedSettings = @{}
foreach ($k in $existingSettings.Keys) { $mergedSettings[$k] = $existingSettings[$k] }

# ── 3. ALWAYS-OVERWRITE: derived / infra-tracked values ─────────
$alwaysOverwrite = @{
    # MSI-based storage binding for the Functions runtime host -
    # works only AFTER Phase 7 grants the MI 'Storage Blob Data Owner'.
    'AzureWebJobsStorage__accountName'      = $envCfg.StorageAccount
    'AzureWebJobsStorage__blobServiceUri'   = "https://$($envCfg.StorageAccount).blob.core.windows.net"
    'AzureWebJobsStorage__queueServiceUri'  = "https://$($envCfg.StorageAccount).queue.core.windows.net"
    'AzureWebJobsStorage__tableServiceUri'  = "https://$($envCfg.StorageAccount).table.core.windows.net"

    # Key Vault references - resolved at app startup using the MI.
    'JWT_SECRET'                            = "@Microsoft.KeyVault(VaultName=$($envCfg.KeyVault);SecretName=JwtSecret)"
    'CSRF_SIGNING_KEY'                      = "@Microsoft.KeyVault(VaultName=$($envCfg.KeyVault);SecretName=CsrfSigningKey)"
    'INVOICE_SIGNING_KEY'                   = "@Microsoft.KeyVault(VaultName=$($envCfg.KeyVault);SecretName=InvoiceSigningKey)"

    # Read by application code via DefaultAzureCredential.
    'AZURE_STORAGE_ACCOUNT_NAME'            = $envCfg.StorageAccount

    # Non-secret settings derived from infra.
    'BLOB_BASE_URL'                         = "https://$($envCfg.StorageAccount).blob.core.windows.net"
    'CORS_ORIGIN'                           = $envCfg.CorsOrigins -join ','
    'ENVIRONMENT'                           = $Environment
    'FUNCTIONS_WORKER_RUNTIME'              = 'node'
    'PUBLIC_SITE_URL'                       = "https://$($envCfg.WebsiteUrl)"

    # Queue names (new-backend.md §2.3 / §14.3).
    'NOTIFICATIONS_QUEUE_NAME'              = 'notifications-out'
    'WEBHOOKS_QUEUE_NAME'                   = 'webhooks-in'
    'REVIEW_QUEUE_NAME'                     = 'review-requests'

    # Container names (new-backend.md §14.1 / §14.3).
    'INVOICE_CONTAINER'                     = 'invoices'
    'USER_UPLOAD_CONTAINER'                 = 'user-uploads'

    # Direct Function-App URL used to build the WhatsApp / email
    # "view invoice" link. Bypasses the SWA in front of
    # PUBLIC_SITE_URL, which on the Free tier cannot proxy /api/* to
    # the linked backend and silently returns the SPA's index.html -
    # which WhatsApp Cloud then caches as the "document".
    'INVOICE_PUBLIC_URL_BASE'               = "https://$($envCfg.FunctionApp).azurewebsites.net/api/invoices"

    # Application Insights.
    'APPLICATIONINSIGHTS_CONNECTION_STRING' = $appInsights.ConnectionString
    'APPINSIGHTS_INSTRUMENTATIONKEY'        = $appInsights.InstrumentationKey
}
foreach ($k in $alwaysOverwrite.Keys) { $mergedSettings[$k] = $alwaysOverwrite[$k] }

# ── 4. DEFAULT-IF-ABSENT: operator-tunable defaults ─────────────
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

# ── 5. EMPTY-IF-ABSENT: operator-pasted secrets + tokens ────────
$emptyIfAbsent = @(
    'INVOICE_LOGO_URL',
    'WHATSAPP_ACCESS_TOKEN',
    'WHATSAPP_PHONE_NUMBER_ID',
    'WHATSAPP_WABA_ID',
    'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
    'WHATSAPP_APP_SECRET',
    'SMTP_PASS'
)
foreach ($k in $emptyIfAbsent) {
    if (-not $mergedSettings.ContainsKey($k)) { $mergedSettings[$k] = '' }
}

# ── 5b. REMOVE: obsolete settings left over from prior deploys ───
#        Azure's appsettings PATCH does not delete unmentioned keys,
#        so we issue an explicit `delete` for keys the app no longer
#        reads. Without this, COOKIE_DOMAIN=.srilatha.art lingers on
#        the prd Function App from the pre-host-only-cookie era and
#        keeps the audit-2026-06-07 finding #1 alive.
$removeIfPresent = @(
    'COOKIE_DOMAIN'  # security audit 2026-06-07: cookies are host-only.
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

# ── 6. Apply the full merged set (via az CLI) ───────────────────
#       `az functionapp config appsettings set --settings` is
#       additive at the service: keys we don't send are preserved.
#       We send the full merged set anyway so the script remains the
#       authoritative source of state for every key it knows about.
#
#       Values are passed as KEY=VALUE strings. az CLI splits on the
#       first '=', so subsequent '=' / ';' / '(' / ')' inside Key
#       Vault references like
#         @Microsoft.KeyVault(VaultName=...;SecretName=...)
#       are preserved verbatim. PowerShell 7's native command
#       argument passing quotes any element containing spaces (e.g.
#       SMTP_SENDER_NAME='Srilatha Art'), so no manual escaping is
#       required.
$settingsArgs = @()
foreach ($k in $mergedSettings.Keys) {
    $settingsArgs += "$k=$($mergedSettings[$k])"
}
az functionapp config appsettings set `
    --name           $envCfg.FunctionApp `
    --resource-group $envCfg.ResourceGroup `
    --settings       $settingsArgs `
    --output         none
if ($LASTEXITCODE -ne 0) {
    throw "Failed to apply Function App settings via az CLI."
}
Write-Success "Function App settings applied (merged $($mergedSettings.Count) keys)"

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
# design promise - "all the durable role assignments are at the
# end" - is fulfilled here. Anything granted in Phase 3 is a
# subset of what we re-assert below.

Write-Step "PHASE 7 - Function App Managed Identity + runtime RBAC"

# ── 7.1  Managed Identity (already enabled in Phase 2.6) ─────────
# MI was enabled in Phase 2.6 so it exists before settings are applied
# and before any code is deployed. $principalId is already set.
Write-Success "Function App MI principalId : $principalId"

# ── 7.2  Clean up any mis-scoped legacy assignment ───────────────
# Earlier versions of this script mis-scoped 'Key Vault Administrator'
# to the Function App resource. Remove it so the only visible vault
# assignment for the SP is the clean Phase 7 one below.
# M4: Use Az PowerShell canonical resource ID (proper casing) rather
# than the all-lowercase ID in `az functionapp show` JSON, which can
# cause Get-AzRoleAssignment's internal scope prefix match to miss.
$faResource = Get-AzResource -ResourceGroupName $envCfg.ResourceGroup -ResourceType 'Microsoft.Web/sites' -Name $envCfg.FunctionApp -ErrorAction SilentlyContinue
$badScope = if ($faResource) { $faResource.ResourceId } else { $functionApp.id }
Get-AzRoleAssignment -ObjectId $spObjectId -Scope $badScope -ErrorAction SilentlyContinue |
    Where-Object { $_.RoleDefinitionName -eq 'Key Vault Administrator' } |
    ForEach-Object {
        Remove-AzRoleAssignment -ObjectId $spObjectId -RoleDefinitionName $_.RoleDefinitionName -Scope $_.Scope -ErrorAction SilentlyContinue
        Write-Info "Removed mis-scoped legacy role: $($_.RoleDefinitionName) at $($_.Scope)"
    }

# ── 7.3  Grant Function App MI its runtime roles ─────────────────
Write-Info "Applying Function App MI runtime roles..."
$miRoleOk = Apply-RolePlan `
    -ObjectId       $principalId `
    -Plan           $mi_RuntimeRoles `
    -StorageAccount $storageAccount `
    -KeyVault       $keyVault `
    -AppInsights    $appInsights
if ($miRoleOk -lt $mi_RuntimeRoles.Count) {
    Write-Err "Only $miRoleOk / $($mi_RuntimeRoles.Count) MI runtime roles assigned - Function App may fail to start. Check Phase 8 output."
}

# ── 7.4  Re-assert deployer SP durable roles ─────────────────────
Write-Info "Re-asserting deployer SP durable roles..."
$spRoleOk = Apply-RolePlan `
    -ObjectId       $spObjectId `
    -Plan           $sp_RuntimeRoles `
    -StorageAccount $storageAccount `
    -KeyVault       $keyVault `
    -AppInsights    $appInsights
if ($spRoleOk -lt $sp_RuntimeRoles.Count) {
    Write-Err "Only $spRoleOk / $($sp_RuntimeRoles.Count) SP runtime roles assigned - secret rotation and deploy-time ops may fail."
}

Write-Info "Waiting 30s for RBAC propagation..."
Start-Sleep -Seconds 30


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

    # Hard-required runtime set - script fails loud if anything is missing.
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
        Write-Err 'The deploy is incomplete. Re-run this script - RBAC reads sometimes lag and the assignment is already in place but not visible yet.'
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
   • InvoiceSigningKey      (auto-generated, 64 chars)
   • RazorpayWebhookSecret  (auto-generated - paste into Razorpay dashboard)
   • RazorpayKeyId          (placeholder - set via infra/Rotate-RazorpayApiKeys.ps1)
   • RazorpayKeySecret      (placeholder - set via infra/Rotate-RazorpayApiKeys.ps1)

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
