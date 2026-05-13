$securePassword = ConvertTo-SecureString $env:MY_APPREG_CLIENT_SECRET -AsPlainText -Force

$credential = New-Object System.Management.Automation.PSCredential (
    $env:MY_APPREG_CLIENT_ID,
    $securePassword
)

Connect-AzAccount `
    -ServicePrincipal `
    -Tenant $env:MY_APPREG_TENANT_ID `
    -Credential $credential | Out-Null