# Pending changes to apply to PRD

Everything in this file mirrors changes that were already applied to **DEV**
during the 2026-05-16 audit + Razorpay integration. None of this has been
applied to PRD yet — PRD requires explicit, awake-and-watching action.

| Env | Resource group | Frontend SWA | Function App |
| --- | --- | --- | --- |
| DEV | `rg-thesrilathaarts-dev` | `https://delightful-mushroom-062e18100.7.azurestaticapps.net/` | `func-thesrilathaarts-dev` |
| PRD | `rg-thesrilathaarts-prd` | `https://www.srilatha.art/` | `func-thesrilathaarts-prd` |

> **Reminder:** the Razorpay test-mode webhook is registered against the **PRD**
> URL (`https://www.srilatha.art/api/razorpay/webhook`). Until the PRD Function
> App has matching env vars, that webhook will fail signature verification on
> every event and Razorpay will mark it unhealthy.

---

## 1. Razorpay Function App settings (do this first)

**Already done in DEV.** Apply the same to PRD:

```powershell
# Run after Connect-AzAccount with the service principal that has
# Contributor on rg-thesrilathaarts-prd.

$razorpaySettings = @{
    'RAZORPAY_KEY_ID'         = 'REMOVED-LEAKED-KEY-ID'
    'RAZORPAY_KEY_SECRET'     = 'REMOVED-LEAKED-KEY-SECRET'
    'RAZORPAY_WEBHOOK_SECRET' = 'REMOVED-LEAKED-WEBHOOK-SECRET'
}

Update-AzFunctionAppSetting `
    -ResourceGroupName 'rg-thesrilathaarts-prd' `
    -Name 'func-thesrilathaarts-prd' `
    -AppSetting $razorpaySettings `
    -Force
```

These are **test-mode** keys/secret. They match what was registered in the
Razorpay Dashboard. Treat them as production-equivalent in storage hygiene
anyway: never commit them; never paste them into a screenshot.

**Verification after applying:**
1. In Razorpay Dashboard → Webhooks, click the webhook entry → "Test webhook"
   → choose `payment.captured`. Razorpay's "Recent Deliveries" tab should show
   a 200 response within a few seconds.
2. Tail the PRD Function App's logs (Application Insights) and confirm there's
   no `razorpayWebhook: signature mismatch` warning.

---

## 2. Key Vault — two bugs to fix on PRD before anything else

The DEV vault (`kv-thesrilathaarts-dev`) had two issues the audit surfaced.
PRD (`kv-thesrilathaarts-prd`) almost certainly has the same problems because
the same script created both. The patched script is in `infra/Deploy-Infrastructure.ps1`
on `develop` (commit `b161062`).

### 2a. The vault is in RBAC auth mode but the script used access policies

`Set-AzKeyVaultAccessPolicy` is a silent no-op when `EnableRbacAuthorization`
is true (the modern default for new vaults). So neither the Function App's
managed identity nor the deployer SP actually has any data-plane access to
the vault — they had been writing to access-policy state that the vault was
ignoring.

**Fix on PRD:**

```powershell
$vaultId  = '/subscriptions/88355f02-7508-401e-a6c0-24993fad9e77/resourceGroups/rg-thesrilathaarts-prd/providers/Microsoft.KeyVault/vaults/kv-thesrilathaarts-prd'
$fnApp    = Get-AzFunctionApp -ResourceGroupName 'rg-thesrilathaarts-prd' -Name 'func-thesrilathaarts-prd'
$miOid    = $fnApp.IdentityPrincipalId
$spOid    = (Get-AzADServicePrincipal -ApplicationId $env:MY_APPREG_CLIENT_ID).Id

# Function App managed identity: read-only
New-AzRoleAssignment -ObjectId $miOid -RoleDefinitionName 'Key Vault Secrets User'    -Scope $vaultId
# Deployer SP: needs Set/Delete so future Deploy-Infrastructure.ps1 runs work
New-AzRoleAssignment -ObjectId $spOid -RoleDefinitionName 'Key Vault Secrets Officer' -Scope $vaultId
```

This needs to be run by an account that has `User Access Administrator` or
`Owner` on the vault (or higher scope). The deployer SP itself **cannot**
grant these — that's why this is a one-time manual unstick step.

### 2b. Remove the mis-scoped legacy "Key Vault Administrator" role

On DEV, an earlier deploy left a stray `Key Vault Administrator` role for
the deployer SP, but scoped to the **Function App** resource instead of the
vault. PRD probably has the same stray assignment. Clean it up:

```powershell
$badScope = (Get-AzFunctionApp -ResourceGroupName 'rg-thesrilathaarts-prd' -Name 'func-thesrilathaarts-prd').Id
$spOid    = (Get-AzADServicePrincipal -ApplicationId $env:MY_APPREG_CLIENT_ID).Id

Get-AzRoleAssignment -ObjectId $spOid -Scope $badScope -ErrorAction SilentlyContinue |
    Where-Object { $_.RoleDefinitionName -eq 'Key Vault Administrator' } |
    ForEach-Object {
        Remove-AzRoleAssignment -ObjectId $spOid -RoleDefinitionName $_.RoleDefinitionName -Scope $_.Scope
        Write-Host "Removed mis-scoped role at $($_.Scope)"
    }
```

The patched infra script does both of these automatically on its next run,
so an alternative to running the two snippets above is:

```powershell
./infra/Deploy-Infrastructure.ps1 -Environment prd
```

…assuming the deployer SP has been granted the role-assignment-write
permission first (RBAC bootstrapping is unavoidably a manual step the
first time).

---

## 3. Move Razorpay secrets from app settings → Key Vault references

Once step 2 is done and the Function App's managed identity has
`Key Vault Secrets User` on the vault, promote the plain-text app settings
from step 1 into Key Vault references.

```powershell
# 1. Write the three secrets to the vault
$kid  = ConvertTo-SecureString 'REMOVED-LEAKED-KEY-ID'   -AsPlainText -Force
$ksec = ConvertTo-SecureString 'REMOVED-LEAKED-KEY-SECRET'  -AsPlainText -Force
$wh   = ConvertTo-SecureString 'REMOVED-LEAKED-WEBHOOK-SECRET'           -AsPlainText -Force

Set-AzKeyVaultSecret -VaultName 'kv-thesrilathaarts-prd' -Name 'RazorpayKeyId'         -SecretValue $kid
Set-AzKeyVaultSecret -VaultName 'kv-thesrilathaarts-prd' -Name 'RazorpayKeySecret'     -SecretValue $ksec
Set-AzKeyVaultSecret -VaultName 'kv-thesrilathaarts-prd' -Name 'RazorpayWebhookSecret' -SecretValue $wh

# 2. Replace the plain-text app settings with @Microsoft.KeyVault(...) references
$kvName = 'kv-thesrilathaarts-prd'
$refs = @{
    'RAZORPAY_KEY_ID'         = "@Microsoft.KeyVault(VaultName=$kvName;SecretName=RazorpayKeyId)"
    'RAZORPAY_KEY_SECRET'     = "@Microsoft.KeyVault(VaultName=$kvName;SecretName=RazorpayKeySecret)"
    'RAZORPAY_WEBHOOK_SECRET' = "@Microsoft.KeyVault(VaultName=$kvName;SecretName=RazorpayWebhookSecret)"
}
Update-AzFunctionAppSetting `
    -ResourceGroupName 'rg-thesrilathaarts-prd' `
    -Name 'func-thesrilathaarts-prd' `
    -AppSetting $refs `
    -Force
```

**Verification:** in the Azure Portal → Function App → Configuration, each
of these three app settings should show a green "Key vault reference" badge
after a few seconds. If you see "Failed to resolve…" the managed identity
isn't yet a `Key Vault Secrets User` — go back to step 2a.

The same migration should be applied to DEV. Today DEV stores the values
as plain app settings only because step 2a couldn't be completed there
during the audit.

---

## 4. Switch from Razorpay TEST keys to LIVE keys (when ready to charge real money)

When you're ready to go live with payments:

1. Activate the Razorpay account in the dashboard (the "You are currently in
   test mode" banner goes away).
2. Generate **live** API keys (Settings → API Keys → "Regenerate Live Key").
   These start with `rzp_live_…`.
3. Create a **new** webhook in the live-mode dashboard pointing at the same
   URL `https://www.srilatha.art/api/razorpay/webhook`, using whatever new
   webhook secret you choose.
4. Update the three Key Vault secrets (or plain app settings if you skipped
   step 3) with the live values:

   - `RazorpayKeyId` → `rzp_live_…`
   - `RazorpayKeySecret` → live key secret
   - `RazorpayWebhookSecret` → the new live-mode webhook secret

5. **Do not touch DEV** during this — DEV stays on test keys.
6. Restart the Function App so the new env vars are picked up (Key Vault
   references refresh on App restart or via the "Sync" button).

No code change is needed — `services/razorpay.ts` and `functions/payments.ts`
are agnostic to test vs live keys; only the key prefix differs.

---

## 5. Other audit follow-ups that affect PRD

These were tracked in `docs/QA_REPORT_2026-05-16.md §9` but worth restating
here so a single PRD checklist exists:

- [ ] Once payments are live, rotate the **test** Razorpay keys in the
      Razorpay Dashboard out of habit (they were briefly visible in chat
      context during the audit).
- [ ] Consider registering a **second** Razorpay webhook pointed at the
      DEV function app URL (`https://func-thesrilathaarts-dev.azurewebsites.net/api/razorpay/webhook`)
      so dev/staging payment flows get the async reconciliation hop too.
- [ ] PRD Function App health-check: after applying the changes in this
      file, run a single test payment end-to-end on `https://www.srilatha.art/`
      with a real test card (`4111 1111 1111 1111`, any future expiry, any
      CVV) and confirm the order appears in `/account` with `paymentStatus = CAPTURED`.

---

## 6. Sanity checklist before declaring PRD ready

Run through this in order. Each box should be tickable before the next.

- [ ] Step 1 done — PRD Function App has `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.
- [ ] "Test webhook" from Razorpay Dashboard returns 200 with no signature
      mismatch warning in App Insights.
- [ ] Step 2a + 2b done — `kv-thesrilathaarts-prd` has the two RBAC role
      assignments at the vault scope and the stray Function App-scoped role
      is gone.
- [ ] Step 3 done — the three app settings have green "Key vault reference"
      badges in the portal.
- [ ] One real test payment completed via Razorpay Checkout on
      `https://www.srilatha.art/`, ends on the success page, internal order
      visible in `/account` with `paymentStatus = CAPTURED`.
- [ ] Webhook event for that same payment shows `200` in Razorpay Dashboard →
      Webhooks → "Recent Deliveries".

When every box is ticked, PRD is functionally where DEV was after the
2026-05-16 audit.
