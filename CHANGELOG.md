# Changelog

All notable changes to Srilatha Art (website + backend) are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Dates are
ISO-8601 in IST (Asia/Kolkata). Starting with 1.0.1 the project adopts semantic
versioning — earlier dated sections are treated as the 1.0.0 baseline.

---

## Unreleased

### Added

- **Admin WhatsApp ping on every new shop order.** `finalizeOrderAfterPayment`
  now fans out the `admin_new_order_v1` template to every number in
  `STUDIO_ADMINS_WHATSAPP_GROUP` once payment is captured, carrying the
  customer's name (`{{1}}`) and mobile number (`{{2}}`). Reuses the existing
  `notifyStudioAdmins` fan-out (per-admin isolation, non-fatal, never throws);
  the only change to that service is an optional `templateName` so the
  custom-order ping (`admin_notification_v1`) and the order ping stay distinct.
  `admin_new_order_v1` still needs Meta approval — see `docs/TODO/LAUNCH-TODO.md`.

---

## 1.0.1 · 2026-07-19 · Payment-race fix, dependency modernization, and repo hygiene

Focused-session pass over payment correctness, dependency backlog, branch protection
strategy, and PR flow. Both `main` and `develop` end the day at the same HEAD;
`ai-driven1` is reset to match. No open pull requests remain.

### Fixed

- **Critical — checkout confirmation could show for cancelled + auto-refunded orders.**
  The Razorpay success handler in `frontend/app/checkout/CheckoutClient.tsx` was
  ignoring the `/razorpay/verify` response body and rendering the confirmation screen
  unconditionally. When a payment landed after `staleReservationCleanup` cancelled the
  order (the ~28-minute race), the backend correctly returned
  `200 { ok: false, status: 'cancelled', message }` and issued an automatic Razorpay
  refund — but the customer was told "Your order is confirmed" while their money was
  being refunded and no invoice / email / WhatsApp went out. Fix: read the body,
  branch on `ok === false || status === 'cancelled'`, surface the server's refund
  message via `setError`, preserve the cart. Verified live on DEV via deployed bundle
  grep (fallback strings present in minified chunk) and by manual Razorpay test-mode
  purchase. (PR #89)
- Invoice PDF `websiteHost` now matches `websiteUrl` (`www.srilatha.art`) for brand
  consistency. Sole consumer: `backend/src/services/invoicePdf.ts:34`. (PR #103)

### Added

- Custom brand-icon components in `frontend/components/icons/`
  (`InstagramIcon`, `FacebookIcon`, `YoutubeIcon`) — inline SVGs matching lucide's
  stroke style, drawn to be visually indistinguishable from the exports lucide-react
  v1.0 removed. Pattern follows the pre-existing `PinterestIcon`. (PR #104)
- Repository ruleset "Protect main and develop" replacing classic branch protection.
  Rules applied to both `refs/heads/main` and `refs/heads/develop`: deletion blocked,
  non-fast-forward pushes blocked, PRs require 1 approving review, stale reviews
  dismissed on push, review-thread resolution required, merge methods restricted to
  merge and squash. `bypass_actors` grants the Repository-Admin role always-bypass,
  which is the load-bearing configuration that makes the flow work for a
  solo-maintained public repo (GitHub blocks PR authors from approving their own PRs;
  ruleset bypass replaces the classic `enforce_admins: true` deadlock).

### Changed

- **Dependabot** now targets `develop` (was `main`), aligning with the
  `ai-driven1 → develop → main` promotion flow. New `groups:` configuration bundles
  patch-level bumps and `@types/*` bumps into single PRs per ecosystem — Monday
  runs will now open ~3 grouped PRs instead of ~13 individual ones. Prevents the
  backlog situation that this session inherited (13 stale Dependabot PRs from
  2026-07-05).
- Frontend upgraded to `lucide-react` 1.25.0 with the three removed brand icons
  replaced by the new custom components above. Touched 5 files: `app/contact/page.tsx`,
  `components/Footer.tsx`, `components/Header.tsx`,
  `components/marketing/v2/FinalInvite.tsx`, `components/MobileDrawer.tsx`. (PR #104)

### Dependencies

Backend (bumps merged):
- `@azure/functions` 4.14.0 → 4.16.2 (minor). (PR #96)
- `@azure/storage-blob` 12.31.0 → 12.33.0 (minor). (PR #78)
- `@types/node` 22.19.20 → 26.1.0 (dev-dep, types-only). (PR #79)
- `@types/nodemailer` 6.4.23 → 8.0.1 (dev-dep, types-only). (PR #95)
- `bcryptjs` 2.4.3 → 3.0.3 (major). Backwards-compatible: `.compare()` handles all
  hash prefixes and `infra/seed-admin.ps1:182` regex already accepts `$2a` / `$2b` /
  `$2y`. Newly-generated hashes now use the `$2b` prefix. (PR #93)
- `dotenv` 16.6.1 → 17.4.2 (major). Dev-only — production reads secrets from Key
  Vault (see 2026-07-05 Phase 2). (PR #73)
- `google-auth-library` 10.6.2 → 10.9.0 (minor). (PR #71)
- `sharp` 0.33.5 → 0.35.3 (native binary, Node 22 compatible). Blast radius: newly-
  generated images going forward; existing on-disk images unaffected. (PR #75)
- `uuid` 11.1.1 → 14.0.1 (major). Single caller in `backend/src/services/blobStorage.ts`
  uses `import { v4 as uuidv4 } from 'uuid'` which is stable across v11–v14. (PR #69)
- Backend-patches group: minor/patch bumps bundled into one PR. (PR #92)

Frontend (bumps merged):
- `autoprefixer` 10.5.0 → 10.5.2 (patch). (PR #74)
- `framer-motion` 11.18.2 → 12.42.2 (major, rebranded "Motion"). API-compatible for
  our usage patterns (`motion.div/section`, `AnimatePresence`, variants); no
  `Reorder` or `useAnimate` consumers. 20+ animation surfaces in marketing V2.
  (PR #72)
- `lucide-react` 0.469.0 → 1.25.0 (see icon-migration note in Changed). (PR #104)
- `@types/node` 22.19.19 → 26.1.0 (dev-dep, types-only). (PR #77)
- Frontend-patches group: minor/patch bumps bundled into one PR. (PR #97)

CI actions (bumps merged):
- `actions/checkout` v4 → v7 (major, well-tested). (PR #66)
- `actions/setup-node` v4 → v7 (`node-version: '22'` pinned so v6/v7 defaults don't
  affect us). (PRs #68, #91)
- `azure/login` v2 → v3 (verified OIDC-compatible inputs already in place —
  `client-id` / `tenant-id` / `subscription-id`). (PR #67)

### Infrastructure

- 3 stale Azure Static Web App preview environments (`25`, `27`, `29`, all sourced
  from `ai-driven1`) were deleted from `swa-thesrilathaarts-dev` to free the Free-tier
  staging-environment quota that was blocking PR #89's frontend deploy. `default`
  preserved. `feedback_swa_stay_free` memory unchanged — Free tier retained.
- `ai-driven1` branch was reset to match `main` at the end of the day so all three
  target branches (main, develop, ai-driven1) end at the same HEAD. The pre-reset
  state is preserved as git tag `archive/ai-driven1-2026-07-19-pre-reset` for future
  extraction of the wins that remained trapped in PR #88 (namely
  `findOrderByRazorpayRefs` and `mergeRazorpayIndexPaymentId`, plus WhatsApp v1
  templates, CSRF auto-retry infrastructure, and admin session/idle-timeout work).

### Deferred — intentionally not shipped

Documented in each closed PR for future action:
- **`next` 15.5.18 → 16.2.10** — closed. All 7 listed HIGH-severity CVEs require a
  Next.js runtime server; our `output: 'export'` static-export build does not run
  one. Bump remains valuable for long-term supportability but has no CVE urgency.
  (PR #100 closed)
- **`tailwindcss` 3.4.17 → 4.3.3** — closed. v4 is a full CSS-first paradigm change
  (`@import "tailwindcss"` replaces `@tailwind` directives; JS config → CSS `@theme`).
  Requires a dedicated migration PR with visual regression across marketing V2.
  (PR #98 closed; earlier PR #70 also closed as superseded)
- **`applicationinsights` 2.9.8 → 3.15.1** — closed. v3 rewrote the SDK (distributed
  tracing via `@azure/monitor-opentelemetry`); build fails on
  `backend/src/utils/telemetry.ts:142`. Requires dedicated observability PR.
  (PR #94 closed)
- **`eslint-config-next` 15 → 16** — closed. Ships together with the Next 16
  migration. (PR #99 closed)
- **`lucide-react` 0.469 → 1.23** — closed as superseded by the proper migration in
  PR #104 (which handles the removed brand icons). (PR #76 closed;
  identical Dependabot PR #101 also closed)
- **`host.json` retry policy** — retained despite Azure Functions runtime deprecation
  warning. The `@azure/functions` v4 Node.js programming model does not expose
  per-trigger `retry` on any function-options interface (only the `RetryOptions` type
  is exported). Deleting the block would change queue-notification retry from
  `3× exponential (~7.5 min window)` to `5× fixed 30s`, worsening behavior during
  downstream (WhatsApp/email) outages. Awaits upstream migration path.

### Non-code work performed

- Merged 21 content PRs and opened 3 develop-to-main promotion PRs
  (#90, #102, #105).
- Closed 8 PRs with evidence-based justifications: #70, #76, #88, #94, #98, #99,
  #100, #101.

---

Executed the 2026-07-03 security assessment findings across both environments,
then landed three tiers of app-code hardening on top. All Phase 1–4 infra
changes are live on both `func-thesrilathaarts-dev` and `func-thesrilathaarts-prd`
and verified healthy end-to-end.

### Implemented — Infra (Phases 1–4)

**Phase 1 · Critical**
- `httpsOnly = true` on both Function Apps (was accepting cleartext HTTP).
- Storage `minimumTlsVersion = TLS1_2` on both accounts (was `TLS1_0`).

**Phase 2 · High**
- 10 inline app-setting secrets migrated to `@Microsoft.KeyVault(...)` refs
  on both envs: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`,
  `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_V2_FUNCTION_KEY`,
  `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`,
  `SMTP_PASS`, `AZURE_OPENAI_API_KEY`, `APPLICATIONINSIGHTS_CONNECTION_STRING`.
- Key Vault `enablePurgeProtection = true` on both vaults (irreversible).
- 4 obsolete app settings deleted: `AzureWebJobsStorage` (inline conn
  string), `AzureWebJobsDashboard`, `APPINSIGHTS_INSTRUMENTATIONKEY`,
  `WEBSITES_ENABLE_APP_SERVICE_STORAGE`.
- New idempotent script `infra/Migrate-SecretsToKeyVault.ps1` (reads inline
  app setting values, writes to KV under canonical camelCase names; `-Overwrite`
  and `-Force` flags for CI/PRD).

**Phase 3 · Medium**
- Dedicated Log Analytics workspace `log-thesrilathaarts-<env>` (PerGB2018,
  30-day retention) in each env's own RG (App Insights' own managed workspace
  carries a Microsoft deny assignment and cannot be a diagnostic target).
- Function App diagnostic setting `send-to-workspace` streaming
  `allLogs` + `AllMetrics` into the LA workspace.
- **Deferred:** App Insights `disableLocalAuth = true` — first attempt on
  DEV blocked all telemetry ingest because the `applicationinsights` v2.9
  SDK in `backend/src/utils/telemetry.ts` is not AAD-aware. Reverted; script
  now skips the block until SDK is upgraded.

**Phase 4 · Low / hygiene**
- New idempotent script `infra/Cleanup-KeyVault.ps1`. Whitelist of the
  13 canonical secret names actually referenced by the deploy script; every
  other KV entry gets soft-deleted (90-day recovery). Sets 1-year `expires`
  attribute on the canonical set. Applied to both envs:
  - DEV KV: 52 non-canonical entries soft-deleted, 13 canonical got 1y expiry.
  - PRD KV: 40 non-canonical entries soft-deleted, 13 canonical got 1y expiry.
- Stray `slotSetting` Function App app-setting purged on both envs
  (created by an earlier mis-quoted `az functionapp config appsettings set`).

**Infra script quality**
- Added `-Force` switch to `Deploy-Infrastructure-v2.ps1` so PRD runs can
  proceed non-interactively (CI, agent, piped).
- Reordered comments in the DEV CORS block to correctly identify
  `www.lucky1.online` as the DEV SWA's custom domain.

### Implemented — App code (audit tiers 1–3)

**Tier 1**
- Removed JWT from `localStorage` on the SPA. The admin JWT is now
  delivered only as the cross-site `HttpOnly` `tsa_token` cookie; the
  Zustand stores persist only non-secret identity (`user`), and `apiFetch`
  re-authenticates via `credentials: 'include'`. Closes XSS exfiltration
  path C1 in the app-code audit.
- Hardened Content Security Policy in `frontend/staticwebapp.config.json`.
- Patched vulnerable transitive dependencies.
- Storefront rendering fixes.

**Tier 2**
- Per-admin-account lockout on `/api/auth/admin/login` (5 failed attempts
  per hour per username, reset on success). Protects against distributed
  rotating-IP brute force that the per-IP limiter alone cannot catch.
- Upload size cap on `/api/upload`.
- Razorpay order-index optimisation.
- CI audit gate: `npm audit --production` required to pass in the backend
  and frontend workflows.

**Tier 3**
- Responsive image variants for product photography.
- Coupon evaluation test coverage.
- Hard Lighthouse budget gate in CI (blocks PRs that regress perf).
- Order stock-rollback service for failed / cancelled orders.

### Implemented — Features (parallel to security work)

- Admin WhatsApp fan-out for custom-order submissions. Every custom-order
  creation now sends the `admin_notification` template to every number in
  `STUDIO_ADMINS_WHATSAPP_GROUP`. Failures per admin are isolated; one
  admin's send failure does not block the rest. New service:
  `backend/src/services/adminNotifications.ts`.
- New admin dashboard tile: **Custom Orders inbox** card
  (`frontend/components/admin/CustomOrdersInboxCard.tsx`) surfacing recent
  submissions.
- New WhatsApp templates: order status updates, return-declined with
  customer notification details, verification OTP.
- Infra/CI: switched backend deploy off `WEBSITE_RUN_FROM_PACKAGE` (which
  required a 10-year SAS URL) back to local-mode (`WEBSITE_RUN_FROM_PACKAGE=1`).
  Removes the long-lived SAS from PRD app settings. First attempt used
  `az functionapp deploy --type zip` (OneDeploy) which is **not**
  supported on Linux Consumption; corrected to
  `az functionapp deployment source config-zip` (Kudu ZipDeploy) — works
  on Linux Consumption and still authenticates via OIDC.

### Deferred / not implemented — still open

Reasons vary from "needs external work" to "needs an architectural
decision I did not want to make unilaterally".

**High**
- **H2 · Split DEV/PRD external credentials.** WhatsApp Business phone
  number + access token, Meta App Secret, Google OAuth client, Azure
  OpenAI API key, and the WhatsApp v2 function key are currently identical
  in both envs. DEV can send messages via PRD's phone number. Needs
  external portal work in Meta Business Manager + Google Cloud Console
  + a dedicated DEV Azure OpenAI resource.
- **H4 · Disable `allowSharedKeyAccess` on storage.** Prerequisite:
  migrate `WEBSITE_CONTENTAZUREFILECONNECTIONSTRING` from shared-key to
  identity-based content share. That migration is delicate on Linux
  Consumption.
- **H5 · Disable `allowBlobPublicAccess`.** Would break anonymous product
  image loading. Needs a CDN or SAS-signed URL design first.

**Medium**
- **M2 · Shorten `WEBSITE_RUN_FROM_PACKAGE` SAS.** Superseded on PRD by
  the `OneDeploy` switch above; DEV still uses `WEBSITE_RUN_FROM_PACKAGE`
  and has the 10-year SAS. Should switch DEV to the same OneDeploy path.
- **M3 · Restrict Key Vault `publicNetworkAccess`.** Requires an
  allowlist design (deployer SP + FA MI + GH Actions IPs). Risk of
  locking out the deployer SP without one.
- **M4 · Enable `disableLocalAuth` on Application Insights.** Prereq:
  `backend/src/utils/telemetry.ts` upgraded to supply an AAD credential
  to `appInsights.setup(...)`, or migrated to
  `@azure/monitor-opentelemetry`. Confirm Linux Consumption runtime
  honours the new credential path before flipping.

**Low**
- **L6 · Defender for Cloud on Standard tier** for Key Vault and Storage
  in PRD (cost decision).

### Verification (both envs, 2026-07-04)

- FA `httpsOnly = true`, Node 22 LTS, FTPS-only.
- Storage `minimumTlsVersion = TLS1_2`, HTTPS-only.
- KV `enablePurgeProtection = true`, RBAC mode, 13 canonical secrets with
  1-year expiries.
- 13 KV refs on each Function App, all resolving to real secret values.
- Log Analytics workspaces created and receiving `FunctionAppLogs` +
  `AzureMetrics`.
- Application Insights ingesting request telemetry via connection string.
- `/api/health` returns `status: ok`, all 4 probes (storage, razorpay,
  whatsapp, email) green.
- Smoke tests on `/api/products`, `/api/auth/csrf`, `/api/auth/me`,
  `/api/announcements`, `/api/pincode/{pin}` all return 200.
- Frontend loads on both SWA hosts; CORS preflight from SWA → FA
  returns 204 with correct origin echo and `Access-Control-Allow-Credentials: true`.

### PRs merged (for the infra + hardening work)

- Phase 1: #48 → develop, #49 → main
- `-Force` switch: #50 → develop, #51 → main
- Phase 2: #52 → develop, #53 → main
- Phase 3: #54 → develop, #55 → main
- Phase 4: #56 → develop, #57 → main
- `slotSetting` audit fix: #58 → develop, #59 → main
- M4 defer: #60 → develop, #61 → main
- `lucky1.online` comment fix: #62 → develop, #63 → main
- App audit tiers 1–3 + admin notifications + WhatsApp templates + OneDeploy:
  #64 → develop, #65 → main

---

## 2026-06-12 · Hero — Italianno script + tighter tempo

User asked for a cursive script face like the "Angela White" reference
they shared, and to drop the inter-line gap further to 0.3s.

### Changed

- **Headline font swapped to Italianno** (Google Fonts, single-weight
  400). Flowing italic script, closest match to the user's reference.
  Loaded via `next/font/google` in `layout.tsx`, exposed as
  `--font-italianno`. Fallback stack `Allura, "Great Vibes", cursive`
  preserves the script aesthetic if Italianno fails to load. Cormorant
  Garamond stays the sitewide `font-serif` token for every other
  h1/h2/h3; Fraunces stays available but no longer applied to the hero.
- **Hero h1 sizing bumped** to accommodate cursive readability:
  3.25rem → 5.5rem → 7rem → 9rem across mobile / sm / lg / xl.
  Letter-spacing dropped to 0 (cursive letters are connected — wide
  tracking breaks the script flow). Line-height tightened to 1.05 →
  1.02 → 0.98 → 0.96 since Italianno carries tall ascenders and the
  three lines look airy without it.
- **Inter-line pauses halved again** from 0.5s → 0.3s. New tempo:
  - t=0.30s Line 1 begins
  - t=1.80s Line 2 begins (was 2.00s)
  - t=3.30s Line 3 begins (was 3.70s)
  - t=4.80s Subtitle (was 5.20s)
  - t=5.20s CTAs (was 5.60s)
  - t=5.60s Social row (was 6.00s)

Total reveal duration ~5.6s.

---

## 2026-06-12 · Hero — Fraunces serif + faster tempo

User asked for a trendier-but-decent display face on the hero, and for
the inter-line pauses halved.

### Changed

- **Headline font swapped to Fraunces** (variable serif used by Aman /
  Are.na / Helvetiq). Loaded via `next/font/google` in `layout.tsx`
  at weights 300/400/500, exposed as `--font-fraunces`. Cormorant
  Garamond stays the sitewide `font-serif` token for every other h1,
  h2, h3 — Fraunces is scoped to the hero h1 only.
- **Hero h1 styling tuned for Fraunces:** weight 400, optical-sizing
  auto, letter-spacing `-0.015em` (Fraunces sets wider by default so a
  slight negative tracking keeps the editorial weight).
- **Inter-line pauses halved** from 1.0s → 0.5s. New tempo:
  - t=0.30s Line 1 begins
  - t=2.00s Line 2 begins (was 2.50s)
  - t=3.70s Line 3 begins (was 4.70s)
  - t=5.20s Subtitle (was 6.30s)
  - t=5.60s CTAs (was 6.80s)
  - t=6.00s Social row (was 7.30s)

Total reveal duration drops from ~7.3s → ~6.0s. Still calm, just
fewer "waiting" beats between phrases.

---

## 2026-06-12 · Hero — three-line sequential reveal

Replaces the single uppercase sans headline with a calmer three-phrase
serif reveal per the user's craftsmanship → care → legacy brief. Mobile
first.

### Changed

- **`HomeHero` headline** is now a single h1 carrying three sequentially
  revealed phrases:
  - *Intentionally handcrafted.*
  - *Securely delivered.*
  - *Forever treasured.*
- **Typography:** Cormorant Garamond (`font-serif`), sentence case,
  weight 400, letter-spacing 0.005em, mobile-first sizing
  (2.25rem → 6xl → 7xl → 8xl). Generous line-height per breakpoint
  (1.18 / 1.12 / 1.08 / 1.05) so the three lines breathe as discrete
  vows on mobile but tighten on desktop where the type carries the
  composition.
- **Period accent:** each line's terminal period is set in cyber gold
  via a decorative `<span aria-hidden>` (so screen-readers don't say
  "full stop" three times).
- **Animation tempo:** calibrated for Apple / Aesop / Aman timing.
  - t=0.30s Line 1 begins (1.2s fade-up to fully visible at 1.50s)
  - t=2.50s Line 2 begins (~1s held pause after Line 1)
  - t=4.70s Line 3 begins (~1s held pause after Line 2)
  - t=6.30s Subtitle reveals
  - t=6.80s CTA pair reveals
  - t=7.30s Social row reveals
  - Easing: `cubic-bezier(0.22, 1, 0.36, 1)` — luxury deceleration.
  - `prefers-reduced-motion` skips choreography entirely.
- **Layout:** centred on mobile (`text-center`, centred social row),
  left-aligned from `sm` upward. Vertical centring inside a
  `min-height: 100svh` section with `pt-28 sm:pt-32 / pb-28 sm:pb-32`
  so the headline never collides with the fixed header on short
  viewports.
- **Reveal primitive:** new local `<Reveal>` component encapsulates the
  initial/animate/transition triplet so each line, subtitle, CTA group,
  and social row share the same easing and motion contract.

---

## 2026-06-12 · Apple-style minimal hero

Rewrite of the homepage hero against an Apple-style reference image the
user supplied ("Brilliant. In every way." composition). Replaces the
5-slide auto-rotating slideshow with a single static editorial hero on
a pure-black canvas.

### Changed

- **`HeroSlideshow.tsx` (still exported as `HomeHero`)** — gutted:
  - Pure `#000000` canvas (no slideshow, no Ken Burns, no scrim layers).
  - Single h1 with a sharp sans display headline: *"Handcrafted. One
    hand, one piece at a time."* The terminal period is gold (the
    only accent of colour on the canvas).
  - Two CTAs, side-by-side: primary `btn-glow-gold` "Explore
    Collections" + secondary `btn-glow-gold-outline` "Order a custom
    piece".
  - Soft top vignette for the fixed Header glyphs; nothing else.
  - Minimal bottom-left social row (WhatsApp · Instagram · "Painting
    since 2020") — same editorial rhythm as the reference image.
  - `prefers-reduced-motion` freezes the staggered fade-in.

### Removed (from the hero)

- Per-slide eyebrow (Resin Art / Dot Mandala / Lippan Art / Kolam Art /
  Wedding Collection).
- Three-item trust strip ("Painting since 2020 · Free shipping ₹999 ·
  7-day returns") — the shipping/returns commitments move down the
  page where the visitor is closer to a buying decision.
- Slideshow autoplay timer, pause/play button, dots indicator, touch-
  swipe handler, slide layers, scrim gradient stack.
- `PictureImage` import — no photography in the hero.

The featured artwork visibility moves to `FeaturedCreations` and
`BestSellers` further down the page, where it can carry product
context (price, CTA) instead of fighting the headline for attention.

---

## 2026-06-12 · Obsidian theme — luxury polish pass

Follow-up after the user surfaced six concrete bugs from the deployed
obsidian theme via screenshots. Fixes the "looks like an admin panel"
problem the token remap caused on a handful of large-surface components.

### Fixed

- **Search overlay full-yellow screen.** `SearchOverlay` was filling the
  viewport with `var(--brand)` (now solid gold) — overwhelming. Rebuilt
  as a centred luxury modal: obsidian backdrop with `blur(12px)
  saturate(140%)`, centred card `#0d0f12` with hairline gold rim,
  click-outside to dismiss, scoped scroll within the result list.
- **Mobile drawer full-gold panel.** Same root cause — the 88vw drawer
  was painted in `var(--brand)`. Replaced with `#0d0f12` solid backing
  and a hairline gold rim, dim layer behind blurred. All `text-plum*`
  (which alias to obsidian dark = invisible on dark) flipped to
  `text-ivory*`.
- **White cards on dark page (Why Choose Us, Handmade Process).** The
  `WhyChooseUs` component explicitly applied `bg-white` over `.card`,
  bleaching the cards. Dropped `bg-white`; cards now use the obsidian
  glass primitive as intended. Icon badges flipped from
  `bg-lavender-light` to `rgba(250,204,21,0.08)` + hairline gold rim
  + gold icon glyph. Connecting timeline rule retuned to cyber gold.
- **Shop category-filter solid-gold bar.** `CategoryChips` rendered as
  a giant gold strip. Now an obsidian translucent rail with
  `blur(12px) saturate(140%)`; chips inherit the segmented-control look
  (transparent inactive, gold-filled active per the `.chip` spec).
- **Sticky cart bar gold blob.** `StickyCartBar` was painted gold with
  `text-plum` labels (invisible). Now an obsidian translucent rail
  with `blur(16px) saturate(160%)`; Add to cart became an outlined
  secondary CTA (gold border + soft gold tint on hover); Buy now stays
  the primary gold pill with `--glow-sm`→`--glow-lg` on hover. Qty
  stepper labels readable again.
- **Custom-order form looked like default inputs.** `bg-white/70`
  fields read as flat grey on the obsidian page. Added new
  `.form-input` primitive (`--bg-input` `#0d0f12`, hairline
  `rgba(255,255,255,0.08)` border, gold focus ring + 3px soft glow,
  custom dark-themed select arrow). `.form-label` companion eyebrow
  added. All three inputs in `CustomOrderClient` (text, select,
  textarea) migrated. Error pill flipped from `bg-red-50` to
  obsidian danger-tinted panel. "Prefer to talk" fallback consumes
  the `.card` primitive.
- **`ProductCard` add-to-cart button** flipped from lavender gradient
  + invisible `text-plum` to canonical gold fill + `--ink-dark` text
  + `--glow-sm` baseline.
- **`BottomTabBar` inactive tabs** flipped from `text-plum-warm`
  (invisible on dark) to `text-ivory-soft`.
- **`Toaster`** info variant flipped from `bg-white/95` to obsidian
  glass-blurred panel; success and error variants tinted in their
  status hues with matching borders. Now uses inline backdrop-filter
  with mobile fallback color.
- **`OurStoryTeaser` image scrim** retuned from warm-ink
  (`rgba(20,16,10,…)`) to obsidian (`rgba(7,8,10,…)`) for tone
  consistency.

### Added

- **`.form-input` / `.form-label`** primitives in `globals.css`. Dark
  fill, hairline border, gold focus state. Reusable across every form
  surface — the next custom-order / checkout / login refactor should
  consume these instead of inline classes.

---

## 2026-06-12 · Premium Obsidian + Cyber Gold theme

Full repaint of the global token system from "Glossy Lavender" → **Premium
Obsidian + Cyber Gold**, per the 60-30-10 spec the user supplied. Replaces
the warm ivory + espresso + gold direction the Studio Vault batch was built
against. Decided after explicit confirmation that the dark theme is wanted
on this repo (not the sibling `srilatha.art`).

### Changed

- **Token system (`globals.css` `:root`):** Rewritten end-to-end against the
  Obsidian + Cyber Gold spec.
  - 60% foundation: `--bg-main: #07080a`, `--bg-surface: #101216`,
    `--bg-card: #15181e`, `--bg-input: #0d0f12`.
  - 30% glass: `--glass-bg: rgba(16,18,22,0.65)`, `--glass-border:
    rgba(255,255,255,0.05)`, `--glass-border-glow: rgba(250,204,21,0.15)`.
  - 10% accent: `--accent-gold: #facc15`, `--accent-gold-hover: #eab308`,
    `--ink-dark: #07080a`.
  - Typography: `--text-primary: #ffffff`, `--text-secondary: #94a3b8`
    (slate-400), `--text-muted: #64748b` (slate-500).
  - Glow tiers: `--glow-sm/md/lg` per spec; status: `--ok-glow`,
    `--danger-glow`.
- **Legacy custom-properties remapped, not renamed.** `--surface`,
  `--text`, `--brand`, `--accent`, etc. all alias the new obsidian
  tokens. ~200 component call sites continue to work without touching
  each one.
- **Tailwind aliases (`tailwind.config.ts`):** `plum`, `lavender`, `ivory`,
  `ink`, `paper`, `cream`, `nav-surface*`, `lavender-glow*` all reroute
  to the obsidian palette. Build-time alpha modifiers preserved via
  `rgb(var(--…-rgb) / <alpha-value>)`.
- **Mobile glass guard.** Every `backdrop-filter: blur()` is now gated
  behind `@media (min-width: 1024px)`. Mobile (<1024px) renders the
  solid `--bg-glass-fallback` (`#12141c`) for paint cost. Affects
  `.card`, `.glass`, `.glass-strong`, `.chip`, `.card-warmglow*`.
- **Standard glass radius:** all glass primitives now use `border-radius:
  16px` (was 20–24px on some).
- **CTA primitives reconverged on the spec:**
  - `.btn-dark` / `.btn-resin` / `.btn-glow-gold` — gold fill,
    `--ink-dark` text, baseline `--glow-sm`, hover `translateY(-3px)` +
    bg → `--accent-gold-hover` + shadow → `--glow-lg`.
  - `.btn-outline` / `.btn-glow-gold-outline` — transparent fill, 1px
    `rgba(255,255,255,0.15)` border, hover border → `--accent-gold` +
    `--glow-sm`.
- **Typography readability shield:** all `h1–h6` now carry a soft
  `text-shadow: 0 2px 10px rgba(0,0,0,0.4)` per spec, so headings stay
  crisp against busy glass backdrops.
- **Body copy default:** all `<p>` inherits `line-height: 1.65` +
  `color: var(--text-secondary)` (slate-400) per spec.
- **Functional colours:** `--ok` → `#22c55e`, `--danger` → `#ef4444`,
  with new `--ok-glow` and `--danger-glow` semantic shadows.
- **PWA + browser chrome:** `theme_color` and `background_color` in
  `manifest.ts` and `viewport.themeColor` in `layout.tsx` updated from
  `#FBF8F2` → `#07080a` so the browser chrome and PWA splash match.
- **Razorpay checkout theme:** `theme.color` updated from `#221B12` →
  `#facc15` so the Razorpay modal matches the cyber-gold accent.
- **Hero scrim and CTAs (`HeroSlideshow`):** scrim flipped from
  warm-ink (`rgba(20,16,10,…)`) to obsidian (`rgba(7,8,10,…)`). CTA
  cluster now uses the canonical `btn-glow-gold` + `btn-glow-gold-outline`
  primitives directly, dropping the warm focal panel.
- **KolamCursorField default colours:** dot field default flipped to
  gold-tinted (`rgba(250,204,21,0.20)`); particle gold updated to match
  the cyber-gold accent. Applies to `HeroExperience` overrides too.
- **CustomOrderCTA step cards:** ditched the lavender inline styles;
  now consume the canonical `.card` primitive. Connecting rule + icon
  badges flipped to gold.
- **`.gold-text`, `.lavender-text`, `.kolam-dots`, `.rule`** all
  redirected to cyber-gold token sources.

### Pending — visual polish on Studio Vault rooms

The v2 marketing components still carry inline `rgba(34,27,18,…)`
(espresso ink) borders and `rgba(20,16,10,…)` warm scrims tuned for the
ivory theme. On obsidian those values either disappear (borders) or
read warmer than the rest of the site (scrims). Compiles fine, no
broken behaviour — pure cosmetic. Files: `OurStoryTeaser.tsx`,
`SectionDivider.tsx`, `Footer.tsx`, `AnalyticsProvider.tsx`,
`v2/CollectionExhibition.tsx`, `v2/ProcessFilm.tsx`,
`v2/FeaturedWorks.tsx`, `v2/PourTransition.tsx`,
`StandaloneFilm.tsx`. Worth a focused second pass when the user has
eyes on the deployed result.

---

## 2026-06-12 · Notification dashboard — honest failure metric

Follow-up to the 2026-06-11 batch. Resolves TODO-N1 (blocking the merge to `develop`).

### Changed

- **`/admin/notifications` failure metric split into two.** The old single "Failure rate"
  counted every queue retry as a separate failure — a notification that failed twice then
  succeeded surfaced as 67% even though the customer received it. Now:
  - **Notification failure rate** — final, unrecoverable failures (`notificationAlerts`
    rows with `isFinal: true`) divided by unique `(orderId, channel, templateKey)` groups
    in the window. This is the customer-impact metric and the only one with the >5% red
    threshold. Subtitle shows raw "N of M notifications".
  - **Attempt failure rate** — failed attempts divided by total attempts (the old calc,
    renamed). Surfaces send-infrastructure health; retries inflate it on purpose; no
    threshold colouring.

### Added

- **`countFinalAlertsInRange(from?, to?)`** in `backend/src/services/notificationAlerts.ts`.
  In-memory filter against the alerts table (small — dedup'd by orderId/channel/operation).
- **New stats fields** on `GET /api/admin/notifications/stats`: `attemptFailureRate`,
  `uniqueNotifications`, `finalFailures`, `notificationFailureRate`. The old `failureRate`
  field is replaced (renamed to `attemptFailureRate`) — the only consumer was the admin
  dashboard, which is updated in the same change.

---

## 2026-06-11 · Studio Vault, dual-channel notifications, inventory reservation, admin observability

Commits: `7940854`, `f76bef2` · Branch: `ai-driven1`

The largest single batch of changes to date. Adds the immersive Studio Vault homepage
experience, refactors notifications onto a typed registry that fires WhatsApp + email
in parallel with a studio audit copy, implements one-of-one inventory reservation,
closes a payment race condition, and gives the admin a single operational view of every
customer-facing communication.

### Added

#### Studio Vault rooms (frontend marketing)

- **Hero Experience** — full-bleed split editorial hero with cursor-reactive `KolamCursorField` backdrop, 4 rotating featured artworks on clip-path wipes, "Liquid Resin Shine" specular highlight.
- **Atelier (Room 02)** — 4-chapter scroll-bound emotional pause; warm B&W monograph treatment Chapters I–III, artist reveal Chapter IV with animated signature draw-in.
- **Process Film (Room 04)** — 5-chapter sticky stage with **Labour Ledger** that accumulates hours (0 → 32) as the visitor scrolls; documents the making of Vermilion Tide; ends with the full commerce ActionPanel.
- **Standalone film route** — `/process-film/vermilion-tide` with autoplay video on every viewport (mobile opt-in).
- **Collections (Room 03)** — horizontal scroll-snap exhibition wing, 5 collection rooms (Resin, Lippan, Kolam, Wedding, Commission) each with per-wing atmosphere.
- **Featured Works (Room 05)** — 8 vertical scroll-snap plates with the signature "Wall Reveal" drag interaction (museum mount ⇄ in-room), full commerce ActionPanel per piece.
- **Final Invite (Room 09)** — scroll-bound kolam mandala draws itself in across two phases; three editorial invitation rows (WhatsApp, Instagram, Commission) + colophon.
- **PourTransition** — scroll-bound viscous SVG resin sheet between rooms with hairline gold catchlight.
- **Liquid Resin Material System** — `.resin-plate`, `.btn-resin`, `.resin-specular` primitives in `globals.css` (top sheen, animated diagonal sweep, cursor-reactive specular).

#### Customer-facing

- **PIN code auto-fill at checkout** — 6-digit PIN typed in shipping form → city + state populate automatically (350ms debounced). Works for the main form and the saved-address edit panel. Backed by the new `/api/pincode/{pin}` proxy to IndiaPost.
- **`AnalyticsProvider` with consent gate** — GA4 + Meta Pixel scripts loaded only after the visitor accepts via a discreet bottom-pinned banner. Renders nothing until at least one of `NEXT_PUBLIC_GA4_ID` / `NEXT_PUBLIC_META_PIXEL_ID` is set.
- **`/process-film/vermilion-tide`** standalone SEO landing page.

#### Backend — dual-channel notification system

- **Template registry** (`backend/src/services/emailTemplates/registry.ts`) — single source of truth mapping each `templateKey` to its WhatsApp template name, email builder, studio-CC policy, and category. Adding a new transactional event = one entry; everything else inherits.
- **7 new email template builders** with a shared branded layout (`shared.ts`):
  - `orderCrafting`, `orderShipped`, `orderDelivered`, `orderCancelled`, `orderRefunded`, `orderOnHold`, `reviewRequest`.
- **3 new WhatsApp template builders** in `notificationsQueue.ts`: `order_delivered`, `review_request`, `refund_processed`.
- **`STUDIO_NOTIFICATION_CC` mechanism** — dispatcher reads the env var (comma-separated), de-duplicates against the recipient, and appends to every transactional email's CC line. Studio gets a complete audit trail of customer communications without log inspection.
- **`email.ts` accepts `cc?: string[]`** — pure transport, no policy.

#### Backend — inventory reservation

- **`reserveStock(productId, qty)` and `restoreStock(productId, qty)`** helpers in `tableStorage.ts` using Azure Table Storage **ETag optimistic concurrency**. Concurrent reservations of a one-of-one piece can no longer both succeed.
- **`InsufficientStockError` and `StockConcurrencyError`** typed errors for clean error messages to the customer.
- **Stale-reservation cleanup** — new timer-triggered Function (`staleReservationCleanup.ts`), runs every 10 minutes. Sweeps `PLACED + PENDING` orders older than `RESERVATION_TIMEOUT_MINUTES` (default 30, env-configurable, clamped ≤ 24h), restores stock per item, marks the order CANCELLED.

#### Backend — Q1 race-condition fix

- **`payment.captured` arriving AFTER an order is already CANCELLED** now triggers:
  1. Razorpay `createRefund` against the captured payment
  2. `paymentAfterCancel: true`, `autoRefundInitiated`, `razorpayRefundId`, `autoRefundError` fields stamped on the order
  3. `finalizeOrderAfterPayment` is **skipped** — no customer confirmation, no invoice email, no WhatsApp message
  4. Red admin alert raised on the Notification Alerts dashboard with the refund outcome embedded in the reason
- Same guard added to the verify path so customers don't see a "confirmed" success screen.
- Stale-reservation cleanup now performs an **ETag-checked** cancel write — if a late webhook lands between read and cancel, the 412 mismatch aborts the cleanup and the webhook's captured-after-cancel path takes over.

#### Backend — admin observability

- **Notification Alerts table** (`notificationAlerts`) — dedup-keyed by `(orderId, channel, operation)` so retries upsert a single row. Failures `recordAlert`; success retries `clearAlert`. Acknowledged alerts persist (audit trail preserved). Re-failure of an acknowledged alert reopens it.
- **Admin endpoints**:
  - `GET /api/admin/notification-alerts` — open alerts only
  - `GET /api/admin/notification-alerts/history` — full audit list
  - `PATCH /api/admin/notification-alerts/{rowKey}` — acknowledge (status flag flip, no delete)
  - `GET /api/admin/notifications/activity` — sitewide email + WhatsApp feed, paginated, filtered by date range / channel / status / template / orderId / customer search. Customer name enriched at read time from a batched per-page order cache.
  - `GET /api/admin/notifications/stats` — aggregate counts, `byChannel`, `byTemplate` breakdown sorted by failures-desc.
- **`NotificationAlertsCard`** widget on `/admin` — auto-polls every 30s, hides when no open alerts, 🔴 red = `isFinal`, 🟡 amber = retrying. Per-alert: customer name, order #, channel, template, attempt count, error reason, timestamp, [View Order] + [Acknowledge].
- **`/admin/notifications`** new page — stat cards, filter bar, per-template breakdown, paginated activity feed with expandable rows.

#### Backend — operational endpoints

- **`/api/health`** — anonymous probe (storage / Razorpay / WhatsApp / SMTP env-var checks) with per-probe latency. Returns 503 if storage probe fails, 200 + `status: "warn"` if non-critical deps unset, 200 + `status: "ok"` otherwise. Designed for Azure Application Insights Availability Tests.
- **`/api/pincode/{pin}`** — anonymous proxy to IndiaPost's public PIN code API. 24h cache header, 4s upstream timeout, returns normalized `{ pincode, city, district, state, country }`.
- **`/api/reviews/recent`** — anonymous, returns latest N approved reviews sitewide. 60s cache.

#### Backend — observability shim

- **Application Insights custom telemetry** (`utils/telemetry.ts`) — typed `trackEvent`, `trackException`, `trackMetric`, `flushTelemetry`. Lazy init, no-op when `APPLICATIONINSIGHTS_CONNECTION_STRING` is unset. Wired into `payments.ts` for `payment.captured`, `webhook.signature_failed`, and `finalize_after_payment` exceptions.
- Added `applicationinsights@^2.9.6` to backend dependencies.

#### Documentation

- **`docs/LAUNCH-TODO.md`** — pre-launch operational tasks (env vars, Meta template approvals, Studio Vault product creation, image optimization pipeline coverage, SMTP deliverability audit).
- **`docs/TODO-notification-system.md`** — post-review follow-ups for the notification system (failure-rate calc fix, PII masking, channel-level cards, cursor pagination, date-range cap, post-launch pre-aggregation).

### Changed

- **`orderState.NOTIFICATIONS`** map — every customer-facing status transition now fires `['whatsapp', 'email']`. Previously only WhatsApp or only email or neither. `DELIVERED` now explicitly notifies the customer (was silent before) and still schedules the 72h review request. `OUT_FOR_DELIVERY`'s never-implemented `push` channel was dropped.
- **`notificationsQueue.ts processNotification`** — replaced the hardcoded `if (channel === 'email' && templateKey === 'order_confirmed')` branch with **registry-based routing**. Per-channel queue messages preserved so a transient failure on one channel doesn't retry the other.
- **`reviewRequestsQueue.ts`** — now enqueues `templateKey: 'review_request'` onto the standard `notifications-out` queue for BOTH channels instead of sending WhatsApp directly. Inherits the registry's fan-out + studio CC. Partial-enqueue-failure tolerated.
- **Razorpay refund webhook (`payments.ts`)** — refund notification now enqueues both channels with the registry's variables instead of dropping the email side silently.
- **Razorpay `payment.captured` handler** — adds the captured-after-cancel branch before the normal capture flow.
- **`/reviews` page** — replaced 5 hard-coded mock reviews with `useQuery` against `/api/reviews/recent`. Empty state honestly says *"We're just opening the studio's public-review wall"*.
- **`Testimonials.tsx`** marketing section — same API switch. Section renders nothing when there are zero real approved reviews (better silent than fake).
- **`payments.ts createPaymentOrder`** — now reserves stock per item before creating the Razorpay order. Compensating restore on Razorpay failure, on order persistence failure, on any unexpected throw.
- **CheckoutClient** — pincode field now triggers the lookup hook; saved-address edit panel gets the same; `PinStatus` widget renders below each PIN field.

### Fixed

- **CRITICAL: Payment captured after order cancellation** (Q1 from the audit) — previously the late webhook would mark `paymentStatus: CAPTURED` on a CANCELLED order, then call `finalizeOrderAfterPayment` which sent the customer a confirmation email + WhatsApp + invoice. Customer paid, was confirmed, expected the piece; admin saw the order as cancelled and didn't ship; manual refund days later. Now: auto-refund + admin alert + no customer message.
- **CRITICAL: One-of-one artwork over-sell race** — two concurrent customers reserving the only piece could previously both pass the `stockQty < qty` check and both succeed at payment. Now: ETag-based atomic decrement; second customer receives a clean 409 "Just sold — please refresh" message.
- **HIGH: Status-transition emails silently dropped** — backend `orderState` enqueued `templateKey: order_shipped` (and similar) for email but `processNotification` only handled `order_confirmed`. Every customer-facing transition email after PLACED was being dropped with a `"no handler"` log line. Now: registry-based routing handles all transition templates.
- **HIGH: Razorpay refund webhook email dropped** — `refund_processed` templateKey had no email handler. Now routed through the registry; both channels fire.
- **MEDIUM: `applicationinsights@2.9.6` 5 transitive vuln advisories** — flagged in launch TODO; not exploitable in the critical path.
- **Frontend testimonials displayed fabricated review names** — Priya Sharma, Rajesh K., Ananya R., Meera Iyer, Vikram S. were all seed data, not real customers. Replaced with real-API-or-empty-state behavior.

### Security

- **No new attack surface introduced.** All new admin endpoints (`/api/admin/notification-alerts*`, `/api/admin/notifications/*`) route through the existing `requireAdmin` middleware. Anonymous requests = 401. Customer-JWT requests = 401 (role check rejects `'customer'`). Admin-JWT requests = 200.
- **CSRF enforced** on the `PATCH /api/admin/notification-alerts/{rowKey}` mutating endpoint via `enforceCsrf`.
- **PII trade-off documented**: full customer name, email, phone, and provider error messages are returned in the activity feed API. The current UI renders them in the table without masking. PII masking on the table view is captured as TODO-N2 in `docs/TODO-notification-system.md` — recommended pre-production but not strictly blocking.

### Deprecated

- **Mock review data in `/reviews/page.tsx` and `Testimonials.tsx`** — replaced by API calls. The fabricated names (Priya Sharma et al.) are no longer in the codebase.
- **The `push` notification channel** in `orderState.NOTIFICATIONS` was unwired and has been removed from `OUT_FOR_DELIVERY`'s customer channels (it never had a handler).

### Operational tasks still required before main / production

Tracked in `docs/LAUNCH-TODO.md`:

1. Set `STUDIO_NOTIFICATION_CC=studio@srilatha.art` on the production Function App.
2. Set `RESERVATION_TIMEOUT_MINUTES` (or accept the default of 30).
3. Get WhatsApp templates approved in Meta Business Manager: `order_crafting`, `order_shipped`, `order_cancelled`, `order_on_hold`, `order_refunded`, `order_delivered` (new), `review_request`.
4. Audit SMTP deliverability (SPF / DKIM / DMARC) on the sender domain. Run a test send through https://mail-tester.com — target ≥ 9/10.
5. Create the 5 Studio Vault catalogue products via Admin Portal (Vermilion Tide, Concentric Devotion, White Threshold, Salt Witness, Doorway VII). Map the resulting product IDs into `frontend/components/marketing/v2/FeaturedWorks.tsx` `WORKS` array and `frontend/components/marketing/v2/shared/processFilmData.ts` `PIECE.productId`.
6. Fix the failure-rate calculation per `docs/TODO-notification-system.md` TODO-N1 (current calc treats retries as separate failures and is misleading).
7. Add PII masking on the activity table view per TODO-N2.

### Acknowledgements

Built collaboratively with Claude Opus 4.7 across multiple sessions. Architecture decisions and verification rounds recorded in conversation. The race-condition fix and the dual-channel notification refactor were anchored on a documented design pass before any code was written.
