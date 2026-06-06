$ErrorActionPreference = 'Stop'

# ------------------------------------------------------------------
# Validate required environment variables
# ------------------------------------------------------------------

$requiredEnvVars = @(
    'MY_APPREG_CLIENT_ID',
    'MY_APPREG_CLIENT_SECRET',
    'MY_APPREG_TENANT_ID'
)

$missingVars = foreach ($var in $requiredEnvVars) {
    if ([string]::IsNullOrWhiteSpace((Get-Item "Env:$var" -ErrorAction SilentlyContinue).Value)) {
        $var
    }
}

if ($missingVars) {
    throw "Missing required environment variables: $($missingVars -join ', ')"
}

# ------------------------------------------------------------------
# Validate Azure PowerShell module
# ------------------------------------------------------------------

$azAccountsModule = Get-Module -ListAvailable -Name Az.Accounts |
    Sort-Object Version -Descending |
    Select-Object -First 1

if (-not $azAccountsModule) {
    throw "Azure PowerShell module 'Az.Accounts' is not installed."
}

Import-Module Az.Accounts -Force

# ------------------------------------------------------------------
# Validate Azure CLI
# ------------------------------------------------------------------

$azCli = Get-Command az -ErrorAction SilentlyContinue

if (-not $azCli) {
    throw "Azure CLI (az) is not installed or not found in PATH."
}

# ------------------------------------------------------------------
# Clear Azure PowerShell sessions
# ------------------------------------------------------------------

Write-Host "Clearing Azure PowerShell sessions..."

Disconnect-AzAccount -Scope Process -ErrorAction SilentlyContinue | Out-Null
Disconnect-AzAccount -Scope CurrentUser -ErrorAction SilentlyContinue | Out-Null

Clear-AzContext -Scope Process -Force -ErrorAction SilentlyContinue
Clear-AzContext -Scope CurrentUser -Force -ErrorAction SilentlyContinue

# ------------------------------------------------------------------
# Clear Azure CLI sessions
# ------------------------------------------------------------------

Write-Host "Clearing Azure CLI sessions..."

az logout --only-show-errors 2>$null
az account clear 2>$null

# ------------------------------------------------------------------
# Authenticate Azure PowerShell
# ------------------------------------------------------------------

Write-Host "Authenticating Azure PowerShell..."

$securePassword = ConvertTo-SecureString `
    $env:MY_APPREG_CLIENT_SECRET `
    -AsPlainText `
    -Force

$credential = [PSCredential]::new(
    $env:MY_APPREG_CLIENT_ID,
    $securePassword
)

$azContext = Connect-AzAccount `
    -ServicePrincipal `
    -Tenant $env:MY_APPREG_TENANT_ID `
    -Credential $credential

# ------------------------------------------------------------------
# Authenticate Azure CLI
# ------------------------------------------------------------------

Write-Host "Authenticating Azure CLI..."

az login `
    --service-principal `
    --username $env:MY_APPREG_CLIENT_ID `
    --password $env:MY_APPREG_CLIENT_SECRET `
    --tenant $env:MY_APPREG_TENANT_ID `
    --only-show-errors | Out-Null

# ------------------------------------------------------------------
# Validation
# ------------------------------------------------------------------

$currentAzContext = Get-AzContext

if (-not $currentAzContext) {
    throw "Azure PowerShell authentication verification failed."
}

$cliAccount = az account show --output json 2>$null | ConvertFrom-Json

if (-not $cliAccount) {
    throw "Azure CLI authentication verification failed."
}

Write-Host ""
Write-Host "Azure authentication successful."
Write-Host "PowerShell Account : $($currentAzContext.Account.Id)"
Write-Host "PowerShell Tenant  : $($currentAzContext.Tenant.Id)"
Write-Host "CLI Tenant         : $($cliAccount.tenantId)"
Write-Host ""