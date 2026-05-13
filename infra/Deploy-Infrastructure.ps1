<#
.SYNOPSIS
    Deploy Azure Infrastructure for Srilatha Art Backend (fresh setup)

.DESCRIPTION
    Creates and configures a brand-new resource group with all required Azure
    resources for the redesigned backend (per new-backend.md):

      - Storage Account (Tables, Queues, Blob Containers)
      - Function App (Consumption, Linux, Node 22)
      - Application Insights
      - Key Vault (RBAC mode) with JwtSecret + CsrfSigningKey
      - Managed Identity + RBAC role assignments
      - All Function App settings including new queue + container names

    Does NOT touch the older `rg-tsa-dev` / `rg-tsa-prd` resource groups.
    Uses Az PowerShell module exclusively.

.PARAMETER Environment
    Target environment: DEV or PRD (PRD config reserved for future fresh recreation).

.EXAMPLE
    .\Deploy-TSAInfrastructure-psCmdlets.ps1 -Environment DEV

.NOTES
    Prerequisites:
    - PowerShell 7+
    - Az module: Install-Module Az -Scope CurrentUser
    - Env vars MY_APPREG_CLIENT_ID / MY_APPREG_CLIENT_SECRET / MY_APPREG_TENANT_ID
      with Contributor + Key Vault Administrator + User Access Administrator
      on the subscription (User Access Administrator is needed to grant RBAC).

    Required Az sub-modules:
      Az.Accounts, Az.Resources, Az.Storage, Az.KeyVault,
      Az.Functions, Az.Websites, Az.ApplicationInsights
#>

[CmdletBinding()]
param(
    [Parameter()]
    [ValidateSet('DEV', 'PRD')]
    [string]$Environment = 'DEV'
)

# ─── Error handling ───────────────────────────────────────────────────────────
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# ============================================================================
# AZURE CONNECTION
# ============================================================================

$securePassword = ConvertTo-SecureString $env:MY_APPREG_CLIENT_SECRET -AsPlainText -Force

$credential = New-Object System.Management.Automation.PSCredential (
    $env:MY_APPREG_CLIENT_ID,
    $securePassword
)

Connect-AzAccount `
    -ServicePrincipal `
    -Tenant $env:MY_APPREG_TENANT_ID `
    -Credential $credential | Out-Null

# ============================================================================
# CONFIGURATION
# ============================================================================
# NOTE: brand-new names - does NOT collide with the legacy rg-tsa-dev / rg-tsa-prd.

$config = @{
    DEV = @{
        ResourceGroup  = 'rg-thesrilathaarts-dev'
        Location       = 'centralindia'
        StorageAccount = 'stthesrilathaartsdev'      # 20 chars, lowercase
        FunctionApp    = 'func-thesrilathaarts-dev'
        StaticWebApp   = 'swa-thesrilathaarts-dev'   # not auto-created here; reserved name
        KeyVault       = 'kv-thesrilathaarts-dev'    # 22 chars
        AppInsights    = 'appi-thesrilathaarts-dev'
        CorsOrigins    = @('http://localhost:3000')   # SWA URL appended after SWA is wired via Portal
        CookieDomain   = ''                            # empty in DEV
    }
    PRD = @{
        ResourceGroup  = 'rg-thesrilathaarts-prd'
        Location       = 'centralindia'
        StorageAccount = 'stthesrilathaartsprd'
        FunctionApp    = 'func-thesrilathaarts-prd'
        StaticWebApp   = 'swa-thesrilathaarts-prd'
        KeyVault       = 'kv-thesrilathaarts-prd'
        AppInsights    = 'appi-thesrilathaarts-prd'
        CorsOrigins    = @('https://www.thesrilathaarts.com', 'https://thesrilathaarts.com')
        CookieDomain   = '.thesrilathaarts.com'
    }
}

$envCfg = $config[$Environment]

# ─── Tables (per new-backend.md §2.1) ────────────────────────────────────────
# Existing legacy: products, orders, orderItems, users, admins, config
# New: orderEvents, ordersByStatus, coupons, couponRedemptions, announcements,
#      wishlist, reviews, customOrders, addresses, notifications, staff, auditLog
$tableNames = @(
    'products', 'orders', 'orderItems', 'users', 'admins', 'config',
    'orderEvents', 'ordersByStatus',
    'coupons', 'couponRedemptions',
    'announcements',
    'wishlist', 'reviews', 'customOrders',
    'addresses', 'notifications',
    'staff', 'auditLog'
)

# ─── Storage Queues (per new-backend.md §2.3) ────────────────────────────────
$queueNames = @(
    'notifications-out',
    'webhooks-in',
    'review-requests'
)

# ─── Blob containers (per new-backend.md §14.1) ──────────────────────────────
# Public read for product/category/asset images; private for invoices & user uploads.
$blobContainers = @(
    @{ Name = 'products'; PublicAccess = 'Blob' }
    @{ Name = 'categories'; PublicAccess = 'Blob' }
    @{ Name = 'assets'; PublicAccess = 'Blob' }
    @{ Name = 'invoices'; PublicAccess = 'Off' }
    @{ Name = 'user-uploads'; PublicAccess = 'Off' }
)

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

function Write-Step {
    param([string]$Message)
    Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "▶ $Message" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
}
function Write-Success { param([string]$Message); Write-Host "  ✓ $Message" -ForegroundColor Green }
function Write-Info { param([string]$Message); Write-Host "  ℹ $Message" -ForegroundColor Yellow }
function Write-Err { param([string]$Message); Write-Host "  ✗ $Message" -ForegroundColor Red }

# ============================================================================
# MAIN SCRIPT
# ============================================================================

Write-Host @"

╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║       Srilatha Art - Infrastructure Deployment           ║
║       (Fresh build - does not touch rg-tsa-*)                 ║
║                                                               ║
║       Environment: $($Environment.PadRight(43))║
║       Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')         ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Magenta

# ============================================================================
# STEP 0: Prerequisites Check
# ============================================================================

Write-Step "Checking Prerequisites"

$requiredModules = @(
    'Az.Accounts', 'Az.Resources', 'Az.Storage', 'Az.KeyVault',
    'Az.Functions', 'Az.Websites', 'Az.ApplicationInsights'
)
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

# ============================================================================
# STEP 1: Resource Group + Core Resources
# ============================================================================

Write-Step "Resource Group: $($envCfg.ResourceGroup)"

$rg = Get-AzResourceGroup -Name $envCfg.ResourceGroup -ErrorAction SilentlyContinue
if ($rg) {
    Write-Success "Resource Group already exists : $($envCfg.ResourceGroup)"
} else {
    Write-Info "Creating Resource Group: $($envCfg.ResourceGroup)"
    New-AzResourceGroup -Name $envCfg.ResourceGroup -Location $envCfg.Location -Tag @{
        project   = 'thesrilathaarts'
        env       = $Environment.ToLower()
        managedBy = 'Deploy-TSAInfrastructure-psCmdlets.ps1'
    } | Out-Null
    Write-Success "Created: $($envCfg.ResourceGroup)"
}

# ── Storage Account ───────────────────────────────────────────────────────────
Write-Step "Storage Account: $($envCfg.StorageAccount)"

$storageAccount = Get-AzStorageAccount `
    -ResourceGroupName $envCfg.ResourceGroup `
    -Name $envCfg.StorageAccount `
    -ErrorAction SilentlyContinue

if ($storageAccount) {
    Write-Success "Storage Account exists : $($envCfg.StorageAccount)"
} else {
    Write-Info "Creating Storage Account: $($envCfg.StorageAccount)"
    $storageAccount = New-AzStorageAccount `
        -ResourceGroupName $envCfg.ResourceGroup `
        -Name $envCfg.StorageAccount `
        -Location $envCfg.Location `
        -SkuName 'Standard_LRS' `
        -Kind 'StorageV2' `
        -AccessTier 'Hot' `
        -AllowBlobPublicAccess $true `
        -EnableHttpsTrafficOnly $true
    Write-Success "Created: $($envCfg.StorageAccount)"
}

# ── Application Insights ──────────────────────────────────────────────────────
Write-Step "Application Insights: $($envCfg.AppInsights)"

$appInsights = Get-AzApplicationInsights `
    -ResourceGroupName $envCfg.ResourceGroup `
    -Name $envCfg.AppInsights `
    -ErrorAction SilentlyContinue

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
    Write-Success "Created: $($envCfg.AppInsights)"
}

# ── Function App ──────────────────────────────────────────────────────────────
Write-Step "Function App: $($envCfg.FunctionApp)"

$functionApp = Get-AzFunctionApp `
    -ResourceGroupName $envCfg.ResourceGroup `
    -Name $envCfg.FunctionApp `
    -ErrorAction SilentlyContinue

if ($functionApp) {
    Write-Success "Function App exists : $($envCfg.FunctionApp)"
} else {
    Write-Info "Creating Function App: $($envCfg.FunctionApp)"
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
    Write-Success "Created: $($envCfg.FunctionApp)"
}

# ── Key Vault ─────────────────────────────────────────────────────────────────
Write-Step "Key Vault: $($envCfg.KeyVault)"

$keyVault = Get-AzKeyVault `
    -ResourceGroupName $envCfg.ResourceGroup `
    -VaultName $envCfg.KeyVault `
    -ErrorAction SilentlyContinue

if ($keyVault) {
    Write-Success "Key Vault exists : $($envCfg.KeyVault)"
} else {
    Write-Info "Creating Key Vault: $($envCfg.KeyVault)"
    $keyVault = New-AzKeyVault `
        -ResourceGroupName $envCfg.ResourceGroup `
        -VaultName $envCfg.KeyVault `
        -Location $envCfg.Location `
        -Sku Standard
    Write-Success "Created: $($envCfg.KeyVault)"
}

# ============================================================================
# STEP 2: Managed Identity + RBAC
# ============================================================================

Write-Step "Enabling Managed Identity & Access Policies"

Write-Info "Enabling System-Assigned Managed Identity..."
Update-AzFunctionApp `
    -ResourceGroupName $envCfg.ResourceGroup `
    -Name $envCfg.FunctionApp `
    -IdentityType SystemAssigned `
    -Force | Out-Null

$functionApp = Get-AzFunctionApp -ResourceGroupName $envCfg.ResourceGroup -Name $envCfg.FunctionApp
$principalId = $functionApp.IdentityPrincipalId
$spObjectId = (Get-AzADServicePrincipal -ApplicationId $env:MY_APPREG_CLIENT_ID).Id

Write-Success "Managed Identity enabled: $principalId"

# Key Vault access policies (get/list secrets)
Set-AzKeyVaultAccessPolicy -VaultName $envCfg.KeyVault -ObjectId $principalId -PermissionsToSecrets Get, List
Set-AzKeyVaultAccessPolicy -VaultName $envCfg.KeyVault -ObjectId $spObjectId -PermissionsToSecrets Get, List, Set, Delete
Write-Success "Key Vault access policies configured"

# Storage RBAC roles
$storageRoles = @(
    @{ Principal = $principalId; Role = 'Storage Blob Data Contributor' }
    @{ Principal = $principalId; Role = 'Storage Table Data Contributor' }
    @{ Principal = $principalId; Role = 'Storage Queue Data Contributor' }
    @{ Principal = $spObjectId; Role = 'Storage Table Data Contributor' }
    @{ Principal = $spObjectId; Role = 'Storage Queue Data Contributor' }
    @{ Principal = $spObjectId; Role = 'Storage Blob Data Contributor' }
)

foreach ($assignment in $storageRoles) {
    $existing = Get-AzRoleAssignment -ObjectId $assignment.Principal -RoleDefinitionName $assignment.Role -Scope $storageAccount.Id -ErrorAction SilentlyContinue
    if (-not $existing) {
        New-AzRoleAssignment -ObjectId $assignment.Principal -RoleDefinitionName $assignment.Role -Scope $storageAccount.Id | Out-Null
        Write-Success "Assigned: $($assignment.Role)"
    }
}

Write-Info "Waiting 15s for RBAC propagation..."
Start-Sleep -Seconds 15

# ============================================================================
# STEP 3: Storage Context (AAD-based, no keys)
# ============================================================================

Write-Step "Preparing Storage Context"

$storageCtx = New-AzStorageContext `
    -StorageAccountName $envCfg.StorageAccount `
    -UseConnectedAccount

Write-Success "Storage context ready (MSI/AAD-based)"

# ============================================================================
# STEP 4: Create Tables
# ============================================================================

Write-Step "Creating Tables in $($envCfg.StorageAccount)"

foreach ($tableName in $tableNames) {
    if (-not (Get-AzStorageTable -Name $tableName -Context $storageCtx -ErrorAction SilentlyContinue)) {
        New-AzStorageTable -Name $tableName -Context $storageCtx | Out-Null
        Write-Success "Created: $tableName"
    }
}

# ============================================================================
# STEP 5: Create Queues
# ============================================================================

Write-Step "Creating Queues in $($envCfg.StorageAccount)"

foreach ($queueName in $queueNames) {
    if (-not (Get-AzStorageQueue -Name $queueName -Context $storageCtx -ErrorAction SilentlyContinue)) {
        New-AzStorageQueue -Name $queueName -Context $storageCtx | Out-Null
        Write-Success "Created: $queueName"
    }
}

# ============================================================================
# STEP 6: Public-blob-access flag
# ============================================================================

Write-Step "Checking Storage Account Public Access Settings"

$storageAccount = Get-AzStorageAccount `
    -ResourceGroupName $envCfg.ResourceGroup `
    -Name $envCfg.StorageAccount

if ($storageAccount.AllowBlobPublicAccess -eq $false) {
    Write-Info "Public blob access is disabled - enabling it now..."
    Set-AzStorageAccount `
        -ResourceGroupName $envCfg.ResourceGroup `
        -Name $envCfg.StorageAccount `
        -AllowBlobPublicAccess $true | Out-Null
    Write-Success "Public blob access enabled"
} else {
    Write-Success "Public blob access already enabled"
}

# ============================================================================
# STEP 7: Create Blob Containers
# ============================================================================

Write-Step "Creating Blob Containers in $($envCfg.StorageAccount)"

foreach ($container in $blobContainers) {
    if (-not (Get-AzStorageContainer -Name $container.Name -Context $storageCtx -ErrorAction SilentlyContinue)) {
        New-AzStorageContainer -Name $container.Name -Context $storageCtx -Permission $container.PublicAccess | Out-Null
        Write-Success "Created: $($container.Name) ($($container.PublicAccess))"
    }
}

# ============================================================================
# STEP 8: Configure CORS on Blob Storage
# ============================================================================

Write-Step "Configuring CORS on Blob Storage"

$corsRules = @(
    @{
        AllowedOrigins  = $envCfg.CorsOrigins
        AllowedMethods  = @('GET', 'HEAD', 'OPTIONS')
        AllowedHeaders  = @('*')
        ExposedHeaders  = @('*')
        MaxAgeInSeconds = 3600
    }
)

Remove-AzStorageCORSRule -ServiceType Blob -Context $storageCtx
Set-AzStorageCORSRule -ServiceType Blob -Context $storageCtx -CorsRules $corsRules
Write-Success "CORS configured for : $($envCfg.CorsOrigins -join ', ')"

# ============================================================================
# STEP 9: Store Secrets in Key Vault
# ============================================================================

Write-Step "Storing Secrets in Key Vault: $($envCfg.KeyVault)"

# JwtSecret - for signing JWT auth tokens
$jwtSecret = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
$jwtSecretValue = ConvertTo-SecureString $jwtSecret -AsPlainText -Force

Set-AzKeyVaultSecret `
    -VaultName $envCfg.KeyVault `
    -Name 'JwtSecret' `
    -SecretValue $jwtSecretValue | Out-Null

Write-Success "Stored secret : JwtSecret (randomly generated, 64 chars)"

# CsrfSigningKey - for double-submit CSRF cookie pattern (new-backend.md §9.1)
$csrfKey = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
$csrfKeyValue = ConvertTo-SecureString $csrfKey -AsPlainText -Force

Set-AzKeyVaultSecret `
    -VaultName $envCfg.KeyVault `
    -Name 'CsrfSigningKey' `
    -SecretValue $csrfKeyValue | Out-Null

Write-Success "Stored secret : CsrfSigningKey (randomly generated, 64 chars)"

# Vendor secrets (Razorpay / Shiprocket / WhatsApp / Email) are intentionally
# NOT created here - add them via the Portal or a follow-up script after you
# sign up for those vendors. See new-backend.md §14.2 for the full list.

# ============================================================================
# STEP 10: Configure Function App Settings
# ============================================================================

Write-Step "Configuring Function App Settings"

$aiConnString = $appInsights.ConnectionString
$aiKey = $appInsights.InstrumentationKey

$appSettings = @{
    # MSI-based storage binding for the Functions runtime host
    'AzureWebJobsStorage__accountName'      = $envCfg.StorageAccount
    'AzureWebJobsStorage__blobServiceUri'   = "https://$($envCfg.StorageAccount).blob.core.windows.net"
    'AzureWebJobsStorage__queueServiceUri'  = "https://$($envCfg.StorageAccount).queue.core.windows.net"
    'AzureWebJobsStorage__tableServiceUri'  = "https://$($envCfg.StorageAccount).table.core.windows.net"

    # Key Vault references
    'JWT_SECRET'                            = "@Microsoft.KeyVault(VaultName=$($envCfg.KeyVault);SecretName=JwtSecret)"
    'CSRF_SIGNING_KEY'                      = "@Microsoft.KeyVault(VaultName=$($envCfg.KeyVault);SecretName=CsrfSigningKey)"

    # Read by application code via DefaultAzureCredential
    'AZURE_STORAGE_ACCOUNT_NAME'            = $envCfg.StorageAccount

    # Non-secret settings
    'BLOB_BASE_URL'                         = "https://$($envCfg.StorageAccount).blob.core.windows.net"
    'CORS_ORIGIN'                           = $envCfg.CorsOrigins -join ','
    'COOKIE_DOMAIN'                         = $envCfg.CookieDomain
    'ENVIRONMENT'                           = $Environment
    'FUNCTIONS_WORKER_RUNTIME'              = 'node'

    # Queue names (new-backend.md §2.3 / §14.3)
    'NOTIFICATIONS_QUEUE_NAME'              = 'notifications-out'
    'WEBHOOKS_QUEUE_NAME'                   = 'webhooks-in'
    'REVIEW_QUEUE_NAME'                     = 'review-requests'

    # Container names (new-backend.md §14.1 / §14.3)
    'INVOICE_CONTAINER'                     = 'invoices'
    'USER_UPLOAD_CONTAINER'                 = 'user-uploads'

    # Application Insights
    'APPLICATIONINSIGHTS_CONNECTION_STRING' = $aiConnString
    'APPINSIGHTS_INSTRUMENTATIONKEY'        = $aiKey
}

Update-AzFunctionAppSetting `
    -ResourceGroupName $envCfg.ResourceGroup `
    -Name $envCfg.FunctionApp `
    -AppSetting $appSettings `
    -Force | Out-Null

Write-Success "Function App settings applied"

# ============================================================================
# STEP 11: Platform CORS on Function App
# ============================================================================

Write-Step "Configuring Platform CORS on Function App"

# Build the CORS object structure expected by ARM
$resourceId = (Get-AzResource `
        -ResourceGroupName $envCfg.ResourceGroup `
        -ResourceType 'Microsoft.Web/sites' `
        -Name $envCfg.FunctionApp).ResourceId

$corsProperties = @{
    cors = @{
        allowedOrigins     = $envCfg.CorsOrigins
        supportCredentials = $true
    }
}

Set-AzResource `
    -ResourceId "$resourceId/config/web" `
    -Properties $corsProperties `
    -ApiVersion '2022-03-01' `
    -Force | Out-Null

Write-Success "Platform CORS configured (with credentials) for: $($envCfg.CorsOrigins -join ', ')"

# ============================================================================
# SUMMARY
# ============================================================================

$functionUrl = "https://$($envCfg.FunctionApp).azurewebsites.net"

Write-Host @"

╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║                   DEPLOYMENT COMPLETE ✓                       ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

Environment       : $Environment
Resource Group    : $($envCfg.ResourceGroup)
Storage Account   : $($envCfg.StorageAccount)
Function App      : $($envCfg.FunctionApp)
Application Insights: $($envCfg.AppInsights)
Key Vault         : $($envCfg.KeyVault)
Function App URL  : $functionUrl

📦 Tables Created ($($tableNames.Count)):
$(($tableNames | ForEach-Object { "   • $_" }) -join "`n")

📬 Queues Created ($($queueNames.Count)):
$(($queueNames | ForEach-Object { "   • $_" }) -join "`n")

🗂️  Blob Containers Created ($($blobContainers.Count)):
$(($blobContainers | ForEach-Object { "   • $($_.Name) (public: $($_.PublicAccess))" }) -join "`n")

🔐 Key Vault Secrets:
   • JwtSecret       (auto-generated)
   • CsrfSigningKey  (auto-generated)
   ℹ Vendor secrets (Razorpay/Shiprocket/WhatsApp/Email) - add later via Portal

⚙️  Function App Settings configured:
   • AzureWebJobsStorage      : MSI-based
   • AZURE_STORAGE_ACCOUNT_NAME, BLOB_BASE_URL, CORS_ORIGIN, COOKIE_DOMAIN
   • JWT_SECRET, CSRF_SIGNING_KEY  (Key Vault refs)
   • NOTIFICATIONS_QUEUE_NAME, WEBHOOKS_QUEUE_NAME, REVIEW_QUEUE_NAME
   • INVOICE_CONTAINER, USER_UPLOAD_CONTAINER
   • APPLICATIONINSIGHTS_CONNECTION_STRING, APPINSIGHTS_INSTRUMENTATIONKEY

📋 Next Steps:
   1. Deploy backend code            : func azure functionapp publish $($envCfg.FunctionApp)
   2. Create Static Web App via Portal: connect to GitHub repo for CI/CD
   3. After SWA exists                : re-run script to add SWA URL to CORS, or
                                         update CORS_ORIGIN app setting manually
   4. Sign up for vendors             : Razorpay, Shiprocket, Meta WhatsApp,
                                         then add their secrets to Key Vault

🛡️  Untouched (legacy):
   ✗ rg-tsa-dev   - left alone
   ✗ rg-tsa-prd   - left alone

"@ -ForegroundColor Green

Write-Host "Deployment completed: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
