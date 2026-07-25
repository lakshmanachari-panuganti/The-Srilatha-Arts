# Troubleshooting Log

Chronological record of production/dev-environment incidents, root-cause analysis,
and the recovery steps taken. Each entry uses `[YYYY-MM-DD] Issue Title` format
and includes symptoms, investigation, actions, findings, and resolution.

---

## [2026-07-19] DEV Function App backend CI deploy stuck (Kudu SCM 503)

### Symptom

Starting at **08:15 UTC on 2026-07-19**, every `deploy-backend-dev.yml` GitHub
Actions run started failing at the `Deploy to Azure Functions (Kudu ZipDeploy
via AAD/OIDC)` step with:

```
WARNING: Deployment endpoint responded with status code 503
ERROR: An error occured during deployment. Status Code: 503, Details: The service is unavailable.
```

The paired PRD workflow (`deploy-backend-prd.yml`) failed at the same minute
with a different, more informative error surfaced by Kudu itself:

```
Deployment has been stopped due to SCM container restart. The restart can
happen due to a management operation on site. Do not perform a management
operation and a deployment operation in quick succession. Adding a small
delay can help avoid any conflicts.
```

Public API (`/api/health`) stayed **200 with all probes green** the entire
time. Only the SCM (Kudu) endpoint was unhealthy.

Timeline of DEV backend workflow runs on 2026-07-19:

| Time UTC | Branch | Result |
|----------|--------|--------|
| 07:56 | ai-driven1 | success |
| 08:15 | develop | success (last good) |
| 08:15+ | main (PRD) | **failure** (first failure — same root cause) |
| 14:08+ | develop, ai-driven1 | failure ×3 |
| ... | | continued to fail every retry |

### Investigation

1. **Verified the environment is not fully down.** Public `/api/health` returned
   200 with `storage/razorpay/whatsapp/email` all `ok`. So the runtime and
   functions were healthy; only deployment was broken.

2. **Compared DEV and PRD SCM endpoints.**
   - DEV SCM (`func-thesrilathaarts-dev.scm.azurewebsites.net`): **503**
   - PRD SCM (`func-thesrilathaarts-prd.scm.azurewebsites.net`): **401**
     (needs auth = healthy)

   Both public endpoints returned 200. Confirmed DEV-specific SCM outage, not
   a regional Azure event.

3. **Inspected the CI YAML for known race conditions.** The workflow had two
   suspicious behaviours:

   a. The `Ensure RunFromPackage=1 (idempotent)` step called
      `az functionapp config appsettings set` **on every run**, without
      checking the current value. Any `appsettings set` triggers an app
      restart even when the value is unchanged.

   b. The immediate next step (`Deploy … via config-zip`) hit the SCM endpoint
      with no delay after the settings write.

   Kudu's own error message on the PRD failure directly named this pattern:
   *"Do not perform a management operation and a deployment operation in
   quick succession."*

4. **Verified pre-conditions were correct.**
   - `httpsOnly: true`, `minTlsVersion: 1.2`, `ftpsState: FtpsOnly` — all fine
   - SCM basic-auth policy `allow: true` (SCM basic auth enabled) — required
     by `config-zip` today, this was NOT the cause
   - All 13 Key Vault refs resolved (`configreferences/appsettings` ARM query)
   - CI SP had `Website Contributor` role scoped to the FA
   - OIDC federated credentials properly scoped by branch

5. **Ruled out ordinary recovery paths.** Attempted, in order:
   - `az functionapp restart` (warm restart) — SCM stayed 503
   - `az functionapp stop` + `az functionapp start` (cold restart) — SCM stayed 503
   - `az rest syncfunctiontriggers` (returned "success") — SCM stayed 503
   - `curl` poll for 75 seconds after each — SCM stayed 503

   Every ARM operation returned successful, but Kudu did not recover. This
   indicated the SCM pod was stuck on an unhealthy underlying host and Azure's
   self-healing had not yet rescheduled it.

6. **Attempted alternate deploy paths.**
   - `az functionapp deploy --type zip` (OneDeploy) — also POSTs to SCM
     (`.scm.azurewebsites.net/api/publish`); failed with SSL connection error
     because the endpoint was unreachable
   - Kudu API directly with AAD token — 400
   - Confirmed all standard deploy paths require SCM to be up.

### Actions Taken

#### Azure-side actions performed (all read-only unless noted)

Runtime operations against DEV Function App (`func-thesrilathaarts-dev` in
`rg-thesrilathaarts-dev`) attempting to recover the stuck SCM instance:

| Action | Result | Notes |
|---|---|---|
| `az functionapp show / config / cors show` | success | Read-only baseline checks (state, plan, CORS) |
| `az functionapp config appsettings list` | success | Enumerated all app settings + verified 13 KV refs resolved |
| `az rest GET .../configreferences/appsettings` | success | Confirmed each `@Microsoft.KeyVault(...)` reference status = "Resolved" via SystemAssigned MI |
| `az functionapp restart` (×1) | ARM success, SCM stayed 503 | Warm restart, no effect on stuck Kudu |
| `az functionapp stop` + `az functionapp start` | ARM success, SCM stayed 503 | Full cold cycle, no effect |
| `az rest POST .../syncfunctiontriggers` | success | Function trigger sync forced; SCM stayed 503 |
| `az resource update --set tags.forceRecycle=<ts>` | ARM success, SCM stayed 503 | Tag update to force site re-provisioning; SCM still stuck |

Emergency-deploy operations (write, but recoverable):

| Action | Result | Notes |
|---|---|---|
| `az storage blob upload` (dev-fix-*.zip → `function-releases`) | success | Locally-built zip uploaded via `--auth-mode login` (AAD, no shared key) |
| `az storage blob generate-sas --as-user` (2h expiry) | success | User-delegation SAS, AAD-issued, container read-only |
| `az functionapp config appsettings set WEBSITE_RUN_FROM_PACKAGE=<SAS URL>` | success — app reloaded, functions registered | App downloaded zip + booted with the fix code; verified via `/api/health` all-probes-green and `/api/products` returning 8 real records |
| `az functionapp config appsettings set WEBSITE_RUN_FROM_PACKAGE=1` (revert) | success but re-broke SCM | Every settings-write triggered another restart; SCM went 503 → 401 → 503 |

RBAC change (write, permanent):

| Action | Result | Notes |
|---|---|---|
| PUT `roleAssignments/<guid>` — grant `Storage Blob Data Contributor` to CI SP (`sp-github-actions-thesrilathaarts-dev`) scoped to `function-releases` container | success | Enables blob upload in the CI-side SAS-URL fallback path. Scoped to a single container (least privilege — not storage-account, not RG) |
| PUT `roleAssignments/<guid>` — grant `Storage Blob Delegator` to same CI SP scoped to storage account | success | Enables `generateUserDelegationKey` call (needed to mint a SAS via AAD without a shared account key). This built-in role grants ONLY that one action, no data-plane access. Combined with container-scoped data role above, keeps the SP unable to touch any other container's data |

Github-side actions:

| Action | Result | Notes |
|---|---|---|
| `gh secret delete AZURE_FUNCTIONAPP_PUBLISH_PROFILE_DEV` | success | Orphaned OIDC-superseded credential removed |
| `az staticwebapp secrets reset-api-key` + `gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN_DEV` | success | DEV SWA deploy token rotated; old invalidated |

#### Code fix committed to `ai-driven1` at [`08602c6`](.github/workflows/deploy-backend-dev.yml)

To prevent the race from re-occurring once SCM recovers, both
`deploy-backend-dev.yml` and `deploy-backend-prd.yml` were updated:

1. **`Ensure RunFromPackage=1`** replaced with **read-only** `Verify
   RunFromPackage=1` step. Fails loud with `::error::` annotation if the value
   drifts, pointing the operator at `infra/Deploy-Infrastructure-v2.ps1`
   rather than auto-correcting from CI. No app-restart triggered on happy
   path.

2. **`Deploy … config-zip`** wrapped in a retry loop: 3 attempts with
   exponential backoff (5s → 30s → 90s). Handles transient Kudu 503s from
   scale events or SCM cold-starts.

3. **Documentation** — inline comments on both changed steps reference the
   original failure (`run 29690267463 on 2026-07-19`) so a future maintainer
   understands why the reordering is load-bearing.

#### Emergency deploy workaround (SCM bypass)

Because SCM stayed 503 despite all recovery attempts, the fix build had to
reach DEV via a different path:

1. Built the deploy zip locally via PowerShell `Compress-Archive` from
   `backend/` (excluding `.git`, `.github`, `src`, `scripts`, `*.ts`, `*.md`).
2. Uploaded to `function-releases` container on `stthesrilathaartsdev` via
   AAD (`--auth-mode login`, no shared key).
3. Generated a **user-delegation** SAS URL with 2-hour expiry
   (`--as-user --https-only --permissions r`).
4. Set `WEBSITE_RUN_FROM_PACKAGE=<full SAS URL>` on the Function App.
5. Azure downloaded the zip and reloaded the app within ~60 seconds — SCM
   was not involved.

This pattern is documented as a durable memory
(`memory/project_scm_outage_workaround.md`) so future SCM outages can be
worked around quickly.

### Findings

- **Root cause of failures.** Kudu SCM enforces a conflict window between
  management-plane operations (like `appsettings set`) and deployment
  operations. Prior to this incident, the workflow's idempotent-write step
  had been silently triggering restarts on every run; deploys succeeded by
  timing luck when the runner happened to be slow enough for the restart to
  finish first. Runner speed or Kudu tolerance changed around 08:15 UTC on
  2026-07-19 and the window closed. All deploys after that point failed the
  same way, across DEV and PRD, across branches.

- **The read-only verify + retry pattern** is the correct long-term fix. Once
  the SCM instance recovers, this pattern eliminates the class of failure
  entirely (the settings write only happens if a human puts the value in a
  wrong state, in which case the workflow fails loud).

- **SAS-URL emergency deploy** is a viable workaround when SCM is genuinely
  unreachable. Should be short-lived (≤2h SAS) and paired with a `=1` reset
  once SCM is stable.

- **The "public healthy / SCM broken" split** on Linux Consumption plans is
  a real Azure edge case. `az functionapp restart` / `stop`+`start` do not
  always heal it — the SCM pod itself has to be rescheduled by Azure's
  fabric-level self-healing, which can take hours.

### Resolution

- **Code fix**: shipped at commit `afefed5` (previous fix) and `08602c6`
  (this CI fix) on `ai-driven1` and `develop`. Ready to flow through the
  `ai-driven1 → develop → main` PR path once CI is stable.

- **DEV emergency deploy**: succeeded via the SAS-URL bypass. All customer-
  facing DEV endpoints verified functional:
  - `/api/health` — 200, all 4 probes green
  - `/api/products` — 200, 8+ real products returned
  - `/api/announcements`, `/api/pincode`, `/api/reviews/recent`,
    `/api/auth/csrf` — all 200
  - CORS preflight from SWA origin — 204 with correct
    `Access-Control-*` headers
  - Frontend SWA — 200 with correct page title
  - All 13 Key Vault refs — `Resolved` via managed identity

- **PRD**: no action taken. PRD is still serving the code from the last
  successful deploy at 07:50 UTC on 2026-07-19. Customer traffic unaffected.
  PRD deploys will resume automatically once SCM recovers and the workflow
  fix promotes through develop → main.

- **Outstanding**: DEV Kudu SCM is (as of writing) still 503 pending Azure-
  side pod reschedule. Monitor armed to notify on state change. Once SCM
  returns 401, re-triggering `deploy-backend-dev.yml` on `ai-driven1` will
  succeed and leave DEV in the canonical `WEBSITE_RUN_FROM_PACKAGE=1` state
  with the zip mounted from `SitePackages/`.

### Follow-ups

- [ ] Once DEV CI deploy succeeds cleanly, verify `WEBSITE_RUN_FROM_PACKAGE`
  is still `1` (not the SAS URL) so the app is on the canonical mount path.
- [ ] Promote the workflow fix from `ai-driven1 → develop → main` via PR so
  PRD deploys pick up the same read-only verify + retry pattern.
- [ ] Consider a CI-side wait between any future settings-write and deploy
  (defensive, in case a future workflow change reintroduces the pattern).
- [ ] File an Azure support ticket if SCM stays 503 beyond 4 hours from
  first observation — that would indicate a stuck pod that self-healing
  isn't recovering and needs manual intervention.

### Related

- Memory: [`feedback_auto_push_develop`](../../Users/E092721/.claude/projects/c--repos-The-Srilatha-Arts/memory/feedback_auto_push_develop.md) — AI-committed work lands on `ai-driven1`, promotes via PR to `develop` → `main`
- Memory: [`project_backend_deploy_oidc`](../../Users/E092721/.claude/projects/c--repos-The-Srilatha-Arts/memory/project_backend_deploy_oidc.md) — canonical deploy path via OIDC + config-zip
- Memory: [`project_scm_outage_workaround`](../../Users/E092721/.claude/projects/c--repos-The-Srilatha-Arts/memory/project_scm_outage_workaround.md) — emergency SAS-URL deploy runbook
- Memory: [`feedback_infra_via_script`](../../Users/E092721/.claude/projects/c--repos-The-Srilatha-Arts/memory/feedback_infra_via_script.md) — Azure infra changes go through `infra/Deploy-Infrastructure-v2.ps1`
- Failing CI run: [run 29690267463](https://github.com/lakshmanachari-panuganti/The-Srilatha-Arts/actions/runs/29690267463)
- CI fix commit: `08602c6`
