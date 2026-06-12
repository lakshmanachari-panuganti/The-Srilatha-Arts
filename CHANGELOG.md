# Changelog

All notable changes to Srilatha Art (website + backend) are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Dates are
ISO-8601 in IST (Asia/Kolkata). The project does not currently use semver — each section
is dated.

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
