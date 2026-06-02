# Pending changes to apply to PRD

| Env | Resource group | Frontend SWA | Function App |
| --- | --- | --- | --- |
| DEV | `rg-thesrilathaarts-dev` | `https://delightful-mushroom-062e18100.7.azurestaticapps.net/` | `func-thesrilathaarts-dev` |
| PRD | `rg-thesrilathaarts-prd` | `https://www.srilatha.art/` | `func-thesrilathaarts-prd` |

> **Status as of 2026-05-17:** PR #8 (develop → main) has been merged.
> Both the prd Function App and the prd SWA have redeployed. Razorpay
> endpoints are live (`/api/razorpay/{webhook,create-order,verify}`),
> the new copy + typography are on `https://www.srilatha.art/`, and the
> webhook signature check is rejecting unsigned posts as expected.
> Admin-configurable shipping settings are now on `develop` (commit
> `e2272c9`) and will land on PRD with the next `develop → main` merge -
> no extra action required after that. The Key Vault hardening below
> remains open work for an admin account.

---

## ✅ 1. Razorpay Function App settings - DONE on PRD (2026-05-17)

The three settings were added to `func-thesrilathaarts-prd` as plain app
settings - same shape as DEV.

| Setting | Value (truncated) | Length |
| --- | --- | --- |
| `RAZORPAY_KEY_ID` | `rzp_test_…` | 23 chars |
| `RAZORPAY_KEY_SECRET` | `pbwB38Ub…` | 24 chars |
| `RAZORPAY_WEBHOOK_SECRET` | `H!jKJDQf…` | 15 chars |

The webhook secret matches what is registered in the Razorpay Dashboard
webhook entry pointed at `https://www.srilatha.art/api/razorpay/webhook`.

If you ever need to re-apply (e.g. settings get wiped by a redeploy):

```powershell
$razorpaySettings = @{
    'RAZORPAY_KEY_ID'         = '<paste from Razorpay Dashboard>'
    'RAZORPAY_KEY_SECRET'     = '<paste from Razorpay Dashboard>'
    'RAZORPAY_WEBHOOK_SECRET' = '<paste from Razorpay Dashboard>'
}
Update-AzFunctionAppSetting `
    -ResourceGroupName 'rg-thesrilathaarts-prd' `
    -Name 'func-thesrilathaarts-prd' `
    -AppSetting $razorpaySettings `
    -Force
```

**Verification to run next:**
1. In Razorpay Dashboard → Webhooks, click the webhook entry → "Test webhook"
   → choose `payment.captured`. The "Recent Deliveries" tab should now show
   a 200 response within a few seconds.
2. Tail the PRD Function App's logs (Application Insights) and confirm there
   is no `razorpayWebhook: signature mismatch` warning.

---

## ⚠️ 2. Key Vault RBAC fixes - still open on PRD

These are intentionally **not** done. They require an account with
role-assignment-write authority (Owner / User Access Administrator /
Role Based Access Control Administrator). The deployer SP has
`Contributor` and `Key Vault Administrator` at the prd RG scope - both
of which are data-plane / sub-resource roles and do **not** include
`Microsoft.Authorization/roleAssignments/write`.

DEV is in the same state. The system runs fine with plain app settings,
so this is hardening rather than a blocker.

### 2a. Add proper RBAC roles at the prd vault scope

```powershell
$vaultId  = '/subscriptions/88355f02-7508-401e-a6c0-24993fad9e77/resourceGroups/rg-thesrilathaarts-prd/providers/Microsoft.KeyVault/vaults/kv-thesrilathaarts-prd'
$fnApp    = Get-AzFunctionApp -ResourceGroupName 'rg-thesrilathaarts-prd' -Name 'func-thesrilathaarts-prd'
$miOid    = $fnApp.IdentityPrincipalId
$spOid    = (Get-AzADServicePrincipal -ApplicationId $env:MY_APPREG_CLIENT_ID).Id

# Function App managed identity: read-only on secrets - enough to resolve
# @Microsoft.KeyVault(...) references at app startup.
New-AzRoleAssignment -ObjectId $miOid -RoleDefinitionName 'Key Vault Secrets User'    -Scope $vaultId

# Deployer SP: needs Set/Delete so future Deploy-Infrastructure.ps1 runs
# can rotate / re-seed secrets on prd.
New-AzRoleAssignment -ObjectId $spOid -RoleDefinitionName 'Key Vault Secrets Officer' -Scope $vaultId
```

### 2b. Remove any mis-scoped legacy role

DEV had a stray `Key Vault Administrator` role for the deployer SP scoped
to the Function App resource (instead of the vault). PRD's existing
assignment is at the RG scope, which is actually fine, so this step is
likely a no-op on PRD - but worth checking:

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

Same authority requirement - needs an admin account.

The patched `infra/Deploy-Infrastructure.ps1` (commit `b161062` on
`develop`) does both of these automatically on its next run, once the
deployer SP has been given role-assignment-write permission first.

---

## ⚠️ 3. Move Razorpay secrets from app settings → Key Vault references

Depends on Step 2a (the Function App MI needs read access on the vault
to resolve `@Microsoft.KeyVault(...)` at startup). Same authority gate
as Step 2.

```powershell
# 1. Write the three secrets to the prd vault. The deployer SP CAN do
#    this even today because Key Vault Administrator at RG scope grants
#    Set-AzKeyVaultSecret.
$kid  = ConvertTo-SecureString '<paste from Razorpay Dashboard>'   -AsPlainText -Force
$ksec = ConvertTo-SecureString '<paste from Razorpay Dashboard>'   -AsPlainText -Force
$wh   = ConvertTo-SecureString '<paste from Razorpay Dashboard>'   -AsPlainText -Force

Set-AzKeyVaultSecret -VaultName 'kv-thesrilathaarts-prd' -Name 'RazorpayKeyId'         -SecretValue $kid
Set-AzKeyVaultSecret -VaultName 'kv-thesrilathaarts-prd' -Name 'RazorpayKeySecret'     -SecretValue $ksec
Set-AzKeyVaultSecret -VaultName 'kv-thesrilathaarts-prd' -Name 'RazorpayWebhookSecret' -SecretValue $wh

# 2. Replace the plain-text app settings with @Microsoft.KeyVault(...) refs.
#    Only do this AFTER Step 2a has been completed by an admin, otherwise
#    the Function App will show "Failed to resolve…" against each setting
#    and Razorpay will break.
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

**Verification after step 3.2:** in the Azure Portal → Function App →
Configuration, each of these three app settings should show a green
"Key vault reference" badge after a few seconds. If you see
"Failed to resolve…", the Function App MI does not yet have
`Key Vault Secrets User` - go back and finish Step 2a.

The same migration should be applied to DEV - DEV stores the values as
plain app settings only because step 2a couldn't be completed there
during the audit either.

---

## 🆕 4. Admin-configurable shipping (lands with next develop → main merge)

Shipping is no longer hardcoded. Admins can set the standard delivery
charge, an optional discounted charge (renders as strike-through on the
cart), and the free-shipping threshold from
**`/admin/settings#shipping`**.

### How it lands on PRD

Nothing manual needed. When the next `develop → main` PR merges:

- The `develop` codebase already contains the feature (`backend/src/services/shippingConfig.ts`,
  `backend/src/functions/shippingSettings.ts`, plus the form on the
  admin settings page).
- The PRD Function App will pick up the three new routes:
  - `GET  /api/shipping-settings`        - public, 60-second cache
  - `GET  /api/admin/shipping-settings`  - admin
  - `PATCH /api/admin/shipping-settings` - admin, CSRF-guarded
- The PRD SWA will pick up the new admin form + dynamic cart/checkout.
- The Azure Table `config` row (`PK='config'`, `RK='shipping'`) is
  written lazily on first save. Until then `getShippingConfig()` returns
  the defaults - which match the previous hardcoded values (₹99 charge,
  ₹2999 threshold). **No silent price changes for existing customers.**

### Optional: pre-seed a config row before deploy

If you want to set up a discount during the deploy window so the strike-
through appears the moment the new UI lights up, you can pre-write the
row from PowerShell (the deployer SP has `Key Vault Administrator` at
RG scope on prd which doesn't include Table write, so this needs a
principal with `Storage Table Data Contributor` on
`stthesrilathaartsprd`). Example values shown in paise:

```powershell
# Run after Connect-AzAccount as a principal with Storage Table Data
# Contributor on the prd storage account.
Import-Module Az.Storage
$ctx = New-AzStorageContext -StorageAccountName 'stthesrilathaartsprd' -UseConnectedAccount
$table = (Get-AzStorageTable -Name 'config' -Context $ctx).CloudTable

$row = New-Object Microsoft.Azure.Cosmos.Table.DynamicTableEntity 'config','shipping'
$row.Properties.Add('value', (New-Object Microsoft.Azure.Cosmos.Table.EntityProperty (
  ConvertTo-Json @{
    baseCharge      = 9900
    effectiveCharge = 4900            # ₹49 - half-price delivery
    freeThreshold   = 299900
    discountLabel   = 'Festive offer · 50% off delivery'
  } -Compress
)))
[Microsoft.Azure.Cosmos.Table.TableOperation]::InsertOrReplace($row) | ForEach-Object { $table.Execute($_) } | Out-Null
```

Easier path: do nothing. After deploy, sign in to `/admin/login`, go to
**Settings → Shipping**, fill the form, hit Save.

### Verification once live

1. `curl https://www.srilatha.art/api/shipping-settings` returns the
   defaults (or whatever was pre-seeded) as JSON.
2. Open `/admin/settings#shipping` as a logged-in admin → form
   prefills, hit Save with a discount → cart preview updates instantly.
3. `https://www.srilatha.art/cart/` for a guest browser with any item
   shows the strike-through `~~₹99~~  ₹49` line if a discount is set.

---

## 5. Switch from Razorpay TEST keys to LIVE keys (future)

When you are ready to charge real money:

1. Activate the Razorpay account in the dashboard (the "You are currently
   in test mode" banner goes away).
2. Generate **live** API keys (Settings → API Keys → "Regenerate Live Key").
   These start with `rzp_live_…`.
3. Create a **new** webhook in the live-mode dashboard pointing at the same
   URL `https://www.srilatha.art/api/razorpay/webhook`, using whatever new
   webhook secret you choose.
4. Update the three Key Vault secrets (or plain app settings if Step 3 is
   not done) with the live values:
   - `RazorpayKeyId` → `rzp_live_…`
   - `RazorpayKeySecret` → live key secret
   - `RazorpayWebhookSecret` → the new live-mode webhook secret
5. **Do not touch DEV** during this - DEV stays on test keys.
6. Restart the Function App so the new env vars are picked up.

No code change is needed - `services/razorpay.ts` and
`functions/payments.ts` are agnostic to test vs live keys; only the key
prefix differs.

---

## 6. Other audit follow-ups that affect PRD

- [ ] **Scrub the Razorpay test secrets from this doc + rotate them in
      the Razorpay Dashboard.** The literal `RAZORPAY_KEY_ID` / `_SECRET`
      / `_WEBHOOK_SECRET` values appear in plaintext in Sections 1 and 3
      below as "re-apply" snippets, which means they live in committed
      git history on both `develop` and `main`. For test-mode keys this
      is acceptable risk; for production it would not be. Once Razorpay
      live-mode goes on, rotate Key Secret + Webhook Secret in the
      Dashboard and replace the snippets in this doc with placeholder
      tokens.
- [ ] Consider registering a **second** Razorpay webhook pointed at the
      DEV Function App URL
      (`https://func-thesrilathaarts-dev.azurewebsites.net/api/razorpay/webhook`)
      so dev/staging payment flows get the async reconciliation hop too.
- [ ] Run a **single test payment end-to-end** on `https://www.srilatha.art/`
      with the Razorpay test card `4111 1111 1111 1111` (any future
      expiry, any CVV). Confirm the order appears in `/account` with
      `paymentStatus = CAPTURED`. This sweeps up: webhook signature
      check, sync verify hop, address persistence, order state machine,
      account-page rendering.
- [ ] After the next `develop → main` merge: load `/admin/settings#shipping`
      as an admin, save a small discount, then confirm the cart on
      `https://www.srilatha.art/` shows the strike-through pricing and
      that `GET /api/shipping-settings` returns the saved values.

---

## 7. Sanity checklist - declaring PRD "DEV-parity ready"

- [x] **Step 1** - PRD Function App has `RAZORPAY_KEY_ID`,
      `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`. _(applied 2026-05-17)_
- [x] **`develop` → `main` PR merged** - code is now on PRD: Razorpay
      endpoints, auth-gated cart, saved-address book, plain-English
      copy, typography refresh, CSRF `SameSite=None`. _(merged 2026-05-17 via PR #8)_
- [x] **PRD deploy verified** - probed live endpoints:
      `/api/auth/csrf` → 200, `/api/razorpay/webhook` POST → 400
      `"Bad signature"` (signature check is engaged),
      `/api/razorpay/{create-order,verify}` POST → 403 (CSRF guard is
      engaged), `/checkout/` and `/account/` static pages → 200.
      Home page contains all the new copy and none of the old
      phrasing. _(verified 2026-05-17)_
- [ ] **"Test webhook" from Razorpay Dashboard** returns 200 with no
      signature-mismatch warning in App Insights. _(can be triggered
      from the dashboard now that the endpoint is live)_
- [ ] **Step 2a + 2b** - `kv-thesrilathaarts-prd` has the two RBAC role
      assignments at the vault scope and any stray Function App-scoped
      role is removed. (Same status on DEV.)
- [ ] **Step 3** - the three app settings show green "Key vault reference"
      badges. (Same status on DEV.)
- [ ] **End-to-end test payment** - one real Razorpay Checkout on
      `https://www.srilatha.art/` with the test card
      `4111 1111 1111 1111`, ends on the success page, the order is
      visible in `/account` with `paymentStatus = CAPTURED`.
- [ ] Webhook event for that same payment shows `200` in Razorpay
      Dashboard → Webhooks → "Recent Deliveries".
- [ ] **Admin-configurable shipping is live on PRD** - after the next
      `develop → main` merge, `GET /api/shipping-settings` on
      `func-thesrilathaarts-prd` returns JSON (defaults are fine), and
      saving a discount from `/admin/settings#shipping` is reflected on
      `/cart` and `/checkout` within ~60 seconds.

PRD is **fully on par with DEV** for everything that does not need
admin-level RBAC authority. The remaining open boxes are either:
- a one-off test you trigger from the Razorpay dashboard (test webhook
  + real test payment), or
- the Key Vault hardening that needs an Owner / User Access
  Administrator account.
