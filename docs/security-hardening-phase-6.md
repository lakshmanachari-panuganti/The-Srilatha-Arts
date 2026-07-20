# Security hardening — Phase 6 (deferred, needs planning)

Three findings from the 2026-07-19 audit remain open on both DEV and PRD.
Each of these is a real project (hours to days), not a flag flip, so they
were intentionally NOT auto-applied during the 2026-07-19 → 2026-07-20
hardening sweep. This document is the runbook for tackling them.

---

## F2 · Remove shared-key access to storage (`WEBSITE_CONTENTAZUREFILECONNECTIONSTRING`)

**Current state.** Both `stthesrilathaartsdev` and `stthesrilathaartsprd`
have `allowSharedKeyAccess = null` (which defaults to `true`). Each
Function App carries an app setting `WEBSITE_CONTENTAZUREFILECONNECTIONSTRING`
containing the full storage account key in plaintext:

```
WEBSITE_CONTENTAZUREFILECONNECTIONSTRING = DefaultEndpointsProtocol=https;AccountName=...;AccountKey=<64-char-secret>;EndpointSuffix=core.windows.net
```

Anyone with `Reader` on the RG can read this key. If leaked, it grants
full data-plane access to every container, queue, table, and file share
(customer PDFs in `invoices`, user uploads, order state, everything).

Documented in the 2026-07-05 changelog as `H4 · deferred` with the note
*"Prerequisite: migrate WEBSITE_CONTENTAZUREFILECONNECTIONSTRING from
shared-key to identity-based content share. That migration is delicate
on Linux Consumption."*

**Migration plan.**

1. **Prep** — verify the FA's SystemAssigned managed identity has the
   `Storage File Data SMB Share Contributor` role on the storage account.
   The existing MI already has `Storage Blob Data Contributor`, `Storage
   Queue Data Contributor`, `Storage Table Data Contributor` but the
   file-share role must be added because `WEBSITE_CONTENTSHARE` is served
   over SMB.

2. **Switch the content share to identity-based** via the four settings
   that Azure Functions supports (documented since 2023):
   - `AzureWebJobsStorage__accountName = stthesrilathaartsdev` — already set
   - `WEBSITE_CONTENTOVERVNET = 1` — routes content share over VNet
   - `WEBSITE_CONTENTSHARE = <existing share name>` — already set
   - `WEBSITE_CONTENTAZUREFILECONNECTIONSTRING` — **remove** (this is F2)

3. **Test on DEV first**, in this order:
   a. Add the file-share role assignment (safe, additive).
   b. Set `WEBSITE_CONTENTOVERVNET=1`.
   c. Remove the connection string setting.
   d. Restart the FA — Azure remounts the content share via MI.
   e. Verify `/api/health` returns 200 with all probes green.
   f. Deploy a code change to confirm content share is writable.

4. **After DEV stable for 24h**, replicate to PRD in a maintenance window.

5. **Once both apps are content-share-identity-based**, set
   `allowSharedKeyAccess = false` on both storage accounts. This is the
   real lockdown — after this, even leaked keys are useless.

**Rollback path.** Re-add the connection string, restart. Keep the key
handy in Key Vault before starting the migration.

**Risk if botched.** Function App won't start (content share unreachable
without valid credentials). Public API returns 503. Both DEV and PRD are
Linux Consumption plans, so the fallback SCM path we built today doesn't
help — the app can't start at all until content share works.

**Estimated effort.** 4-6 hours of focused work + 24h DEV soak before PRD.

---

## F5 · `allowBlobPublicAccess = false` on both storage accounts

**Current state.** Both storage accounts have `allowBlobPublicAccess = true`
(default). Two containers use it legitimately:
- `products` — product photography served anonymously to the storefront
- `categories` — category thumbnails, same

Setting `allowBlobPublicAccess = false` at the account level overrides
container-level settings and would immediately 404 all storefront images.

**Migration plan.**

Option A — **Azure Front Door / CDN in front of storage** (cleanest):
1. Provision a CDN endpoint (Azure Front Door Standard tier or Azure
   CDN Classic — Front Door has better cache-purge and WAF).
2. Origin = the storage account blob endpoint.
3. Migrate the frontend's `BLOB_BASE_URL` env var to point at the CDN
   hostname instead of `stthesrilathaartsprd.blob.core.windows.net`.
4. Lock storage: `allowBlobPublicAccess = false`; the CDN's managed
   identity gets `Storage Blob Data Reader` on the account.
5. Now the storage account is 100% private and CDN serves the public
   assets. Bonus: CDN caching improves storefront performance.

Option B — **SAS URLs for every image** (heavier code change):
1. Backend service generates short-lived SAS URLs for each image on demand.
2. Frontend calls a new `/api/images/<path>` endpoint that returns the SAS URL.
3. Deploys the SAS URL to the `<img src>` tag.
4. Lock storage: `allowBlobPublicAccess = false`.
5. Complex, extra API call per image, still leaks the URL to browser
   inspectors. Not recommended.

Option C — **Container-level access lists** — not applicable, this
requires Storage Firewall + VNet, and the storefront visitors are
public traffic from anywhere.

**Recommendation:** Option A. Azure Front Door Standard is ~$35/month
which is a reasonable cost for the security improvement + performance
gain. Frontend change is a single env var flip.

**Estimated effort.** 1 day (provision + migrate URL base + verify +
lock storage), spread across DEV validation + PRD cutover.

---

## F6 · Key Vault `publicNetworkAccess = Enabled`

**Current state.** Both `kv-thesrilathaarts-dev` and `kv-thesrilathaarts-prd`
have `publicNetworkAccess = Enabled`. Anyone with valid AAD credentials
can access from any IP. Credentials themselves are the only gate.

Documented in the 2026-07-05 changelog as `M3 · deferred` with the note
*"Requires an allowlist design (deployer SP + FA MI + GH Actions IPs).
Risk of locking out the deployer SP without one."*

**Migration plan.**

Option A — **Private endpoint + AAD-authenticated Portal/az from admin
machine** (most secure):
1. Create a VNet in each RG (`vnet-thesrilathaarts-<env>`) with a
   `/24` address space.
2. Create a private endpoint for the Key Vault in that VNet.
3. Enable VNet integration on the Function App so it can reach KV over
   the private endpoint.
4. Verify KV refs still resolve on the FA (via the ARM
   `configreferences/appsettings` endpoint we used today).
5. Set KV `publicNetworkAccess = Disabled`.
6. Admin access from developer machines routes through a per-user
   allowlist on the KV firewall (needs `Selected networks` set to
   Enabled and the admin's public IP added).

Option B — **IP allowlist only** (simpler but brittle):
1. Set KV `publicNetworkAccess = Enabled` but `defaultAction = Deny`,
   with an IP allowlist covering:
   - GitHub Actions runner IP ranges (huge list, changes weekly)
   - Deployer SP outbound IPs (via NAT gateway on the VNet if we build one)
   - Admin machine public IP(s)
2. Verify all deploys and health checks still work.
3. Downside: GitHub's IP ranges are ~500 CIDRs and rotate; keeping the
   allowlist current is a chore.

**Recommendation:** Option A. VNet + private endpoint is the real
solution; Option B is a half-measure that trades one operational burden
for another.

**Estimated effort.** 1-2 days including VNet design, testing that the
Function App can reach KV through the private endpoint on Linux
Consumption (which historically has quirks with VNet integration).

---

## Priority order for Phase 6

1. **F2 first.** The shared-key exposure is the highest-severity item
   still open — a single leaked key destroys the security model. It's
   also relatively contained (Function App content share only).
2. **F5 second.** Public blob access is a real risk but currently only
   covers product images (public by design). Front Door migration also
   gives performance benefits, so it's a positive-sum change.
3. **F6 third.** Least urgent — KV is already protected by AAD auth and
   short-lived tokens. Network-level lockdown is defense in depth.

## What's already done (Phases 1-5)

Reference summary of the security work that landed 2026-07-19 → 2026-07-20:

| Item | Status |
|---|---|
| F1 · Orphaned publish-profile secrets removed (DEV + PRD) | ✓ |
| F3 · Production environment protection (limited by GitHub Free tier) | ✓ (branch ruleset provides gate) |
| F4 · SWA API tokens rotated (DEV + PRD) | ✓ |
| F5 · Unused public containers locked (`assets`, `branding` × 2 envs) | ✓ |
| CI SP roles reviewed and re-scoped (both envs) | ✓ |
| Backend deploy workflow: SAS-URL fallback for SCM outages (DEV + PRD) | ✓ |
| `function-releases` container lifecycle policy (30-day expire, both envs) | ✓ |
| Branch protection ruleset on `main` + `develop` | ✓ (pre-existing) |
| All app secrets via Key Vault refs | ✓ (pre-existing, 13 refs both envs) |
| OIDC for CI (no publish profiles, no long-lived Azure secrets in GH) | ✓ (pre-existing) |
| `httpsOnly`, TLS 1.2, FTPS-only | ✓ (pre-existing) |
| Storage account access via managed identity (blob, queue, table, App Insights) | ✓ (pre-existing, except file share = F2) |
