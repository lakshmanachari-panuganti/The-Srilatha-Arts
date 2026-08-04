# Pre-transfer secret inventory

Captured before migrating repos from `lakshmanachari-panuganti-lab` (user) to
`lakshmanachari-panuganti` (org).

**Secret values are write-only — nobody can read them back, including GitHub's own API.**
If a secret does not survive a transfer it must be **regenerated from its source system**.
This file records only the names, so you know what to check for.

| Repo | Secrets |
|---|---|
| PhotoSheet-Maker | *(none)* |
| PowerShell | *(none)* |
| UserStory-Implementation | *(none)* |
| navya-cloud-kitchen | `AZURE_STATIC_WEB_APPS_API_TOKEN_DEV`, `AZURE_STATIC_WEB_APPS_API_TOKEN_PRD` |
| srilatha.art | `AZURE_FUNCTIONAPP_PUBLISH_PROFILE_DEV`, `AZURE_STATIC_WEB_APPS_API_TOKEN_DEV` |
| srilatha.art.v2 | `AZURE_CLIENT_ID_DEV`, `AZURE_CLIENT_ID_WHATSAPP`, `AZURE_STATIC_WEB_APPS_API_TOKEN_DEV`, `AZURE_SUBSCRIPTION_ID`, `AZURE_TENANT_ID`, `POST_DEPLOY_TEST_CUSTOMER_EMAIL_DEV`, `POST_DEPLOY_TEST_CUSTOMER_PASSWORD_DEV` |
| thesrilathaarts | `AZURE_CLIENT_ID_DEV`, `AZURE_CLIENT_SECRET_DEV`, `AZURE_FUNCTIONS_PUBLISH_PROFILE_DEV`, `AZURE_STATIC_WEB_APPS_API_TOKEN_DEV`, `AZURE_STATIC_WEB_APPS_API_TOKEN_PRD`, `AZURE_STORAGE_CONNECTION_STRING_DEV`, `AZURE_SUBSCRIPTION_ID`, `AZURE_TENANT_ID`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID` |
| OMG.PSUtilities | `PSGALLERY_API_KEY` |
| The-Srilatha-Arts | `AZURE_CLIENT_ID_DEV`, `AZURE_CLIENT_ID_PRD`, `AZURE_STATIC_WEB_APPS_API_TOKEN_DEV`, `AZURE_STATIC_WEB_APPS_API_TOKEN_PRD`, `AZURE_SUBSCRIPTION_ID`, `AZURE_TENANT_ID`, `CLAUDE_CODE_OAUTH_TOKEN`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID` |

No repository **variables** are set anywhere. No environments exist yet.

## Where each secret comes from, if it must be recreated

| Secret | Source |
|---|---|
| `AZURE_STATIC_WEB_APPS_API_TOKEN_*` | Azure Portal → Static Web App → Manage deployment token |
| `AZURE_CLIENT_ID_*`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` | Not secret — readable from Azure (`az account show`, app registration) |
| `AZURE_CLIENT_SECRET_DEV` | **Must be regenerated** — app registration secrets cannot be re-read |
| `AZURE_*_PUBLISH_PROFILE_*` | Azure Portal → Function App → Get publish profile |
| `AZURE_STORAGE_CONNECTION_STRING_DEV` | Azure Portal → Storage account → Access keys |
| `PSGALLERY_API_KEY` | **Must be regenerated** — powershellgallery.com → API Keys |
| `CLAUDE_CODE_OAUTH_TOKEN` | `claude setup-token` |
| `NEXT_PUBLIC_*` | Not secret — config values, in source/docs |
| `POST_DEPLOY_TEST_CUSTOMER_*` | Your own test-account records |

## Transfer order

Rehearsal first, riskiest last. Validate the mechanics on repos with nothing to lose,
then validate secret survival on a low-value repo that has secrets, before touching
anything that deploys or publishes.

1. `PhotoSheet-Maker` — private, no CI, no secrets → tests transfer mechanics
2. `PowerShell`, `UserStory-Implementation` — no secrets
3. `srilatha.art` — **first repo with secrets**; tells us whether secrets survive
4. `srilatha.art.v2`, `thesrilathaarts` — legacy, more secrets
5. `navya-cloud-kitchen` — private + CI
6. `OMG.PSUtilities` — PSGallery publishing
7. `The-Srilatha-Arts` — Azure OIDC, agents, rulesets; most moving parts
