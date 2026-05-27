param(
    [Parameter(Mandatory = $true)]
    [string]$FunctionAppName,

    [Parameter(Mandatory = $true)]
    [string]$KeyVaultName
)

# ------------------------------------------------------------
# Az Connection
# ------------------------------------------------------------
$securePassword = ConvertTo-SecureString $env:MY_APPREG_CLIENT_SECRET -AsPlainText -Force
$credential = New-Object System.Management.Automation.PSCredential ($env:MY_APPREG_CLIENT_ID, $securePassword)
Connect-AzAccount -ServicePrincipal -Tenant $env:MY_APPREG_TENANT_ID -Credential $credential | Out-Null
# ------------------------------------------------------------

$backupDate = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")

Write-Host "==============================================="
Write-Host "Function App Settings Backup"
Write-Host "==============================================="
Write-Host "Function App : $FunctionAppName"
Write-Host "Key Vault    : $KeyVaultName"
Write-Host "Backup Date  : $backupDate"
Write-Host ""

# ------------------------------------------------------------
# Get Function App
# ------------------------------------------------------------
$functionApp = Get-AzFunctionApp |
    Where-Object { $_.Name -eq $FunctionAppName }

if (-not $functionApp) {
    throw "Function App '$FunctionAppName' not found."
}

$resourceGroupName = $functionApp.ResourceGroup
$location = $functionApp.Location

Write-Host "Resource Group : $resourceGroupName"
Write-Host "Location       : $location"
Write-Host ""

# ------------------------------------------------------------
# Create Key Vault if it does not exist
# ------------------------------------------------------------
$keyVault = Get-AzKeyVault `
    -VaultName $KeyVaultName `
    -ErrorAction SilentlyContinue

if (-not $keyVault) {

    Write-Host "Key Vault does not exist."
    Write-Host "Creating Key Vault: $KeyVaultName"

    $keyVault = New-AzKeyVault `
        -Name $KeyVaultName `
        -ResourceGroupName $resourceGroupName `
        -Location $location `
        -Sku Standard

    Write-Host "Key Vault created successfully."
    Write-Host ""
} else {

    Write-Host "Key Vault already exists."
    Write-Host ""
}

# ------------------------------------------------------------
# Get ALL Function App Settings
# ------------------------------------------------------------
$appSettings = Get-AzWebAppApplicationSetting `
    -ResourceGroupName $resourceGroupName `
    -Name $FunctionAppName

# ------------------------------------------------------------
# Backup ALL settings
# ------------------------------------------------------------
foreach ($setting in $appSettings.Properties.GetEnumerator()) {

    $originalKey = $setting.Key
    $value = $setting.Value

    # --------------------------------------------------------
    # Key Vault secret names do not allow "_"
    # --------------------------------------------------------
    $secretName = $originalKey.Replace("_", "-")

    Write-Host "Backing up: $originalKey -> $secretName"

    $secureValue = ConvertTo-SecureString `
        -String $value `
        -AsPlainText `
        -Force

    # --------------------------------------------------------
    # Store Secret
    # Every update automatically creates a NEW VERSION
    # --------------------------------------------------------
    Set-AzKeyVaultSecret `
        -VaultName $KeyVaultName `
        -Name $secretName `
        -SecretValue $secureValue `
        -Tag @{
        OriginalKey = $originalKey
        BackupDate  = $backupDate
        SourceApp   = $FunctionAppName
    } | Out-Null
}

Write-Host ""
Write-Host "==============================================="
Write-Host "Backup completed successfully."
Write-Host "==============================================="