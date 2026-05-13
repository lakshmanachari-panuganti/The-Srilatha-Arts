# Srilatha Art - Backend & Azure Infrastructure Plan

> Companion to [new-frontend.md](new-frontend.md). Catalogs every backend code change and every Azure resource change required to deliver the mobile-first redesign - order management, coupons, announcement bar, custom orders, reviews, wishlist, real payments, WhatsApp + email notifications, and the expanded admin panel.

Grounded in the current state of:
- `backend/src/functions/*` - products, productAdmin, orders, orderAdmin, userAuth, adminAuth, upload
- `backend/src/services/*` - tableStorage, blobStorage, auth
- `backend/src/middleware/*` - adminGuard, userGuard
- Verified Azure infra (memory `project_azure_infra.md`, 2026-05-11)

---

## Table of Contents

1. [Current State Snapshot](#1-current-state-snapshot)
2. [Data Model Changes](#2-data-model-changes)
3. [Refactor: Orders PK Strategy](#3-refactor-orders-pk-strategy)
4. [HTTP Functions - Customer Side](#4-http-functions--customer-side)
5. [HTTP Functions - Admin Side](#5-http-functions--admin-side)
6. [HTTP Functions - Coupons](#6-http-functions--coupons)
7. [HTTP Functions - Announcement Bar](#7-http-functions--announcement-bar)
8. [HTTP Functions - Other New Endpoints](#8-http-functions--other-new-endpoints)
9. [Auth: Move JWT to httpOnly Cookie](#9-auth-move-jwt-to-httponly-cookie)
10. [Shared Services](#10-shared-services)
11. [Queue & Timer Functions](#11-queue--timer-functions)
12. [Order State Machine](#12-order-state-machine)
13. [Server-Side Validation Hardening](#13-server-side-validation-hardening)
14. [Azure Infrastructure Changes](#14-azure-infrastructure-changes)
15. [PRD Cleanup Checklist](#15-prd-cleanup-checklist)
16. [Observability & Alerts](#16-observability--alerts)
17. [Migration Strategy](#17-migration-strategy)
18. [Phased Delivery](#18-phased-delivery)

---

## 1. Current State Snapshot

### 1.1 What exists today (don't rebuild)

| Layer | Asset |
|---|---|
| Functions | `getProducts`, `getProductById`, `createNewOrder`, `listOrders`, `updateOrderStatus`, `userRegister`, `userLogin`, `googleAuth`, `adminLogin`, `uploadImage`, `productAdmin` CRUD |
| Services | `tableStorage.ts` (Tables: products, orders, orderItems, users, admins, config), `blobStorage.ts`, `auth.ts` (JWT + bcrypt) |
| Middleware | `adminGuard`, `userGuard` |
| Patterns | `DefaultAzureCredential` everywhere ✓ · `routePrefix: ""` + `api/` baked in ✓ (reserved-`admin/` workaround) · `corsPreflightResponse` helper ✓ · server-side authoritative price lookup on order create ✓ |

### 1.2 Critical gaps vs. new-frontend.md

| Gap | Where it bites |
|---|---|
| Only 5 order statuses (`pending/confirmed/shipped/delivered/cancelled`) | Need 12 (§7.9.9 of new-frontend.md) |
| Status is `partitionKey` and `updateOrderStatus` physically moves rows | Won't scale to 12 statuses; existing duplicate-row failure mode is documented in [tableStorage.ts:114-116](backend/src/services/tableStorage.ts#L114-L116) |
| `GET /api/orders/:id` is admin-only | Customer can't see their own order |
| No `/api/orders/me` | Customer can't list their orders |
| No event log | Both customer timeline and admin activity feed are stories without data |
| No coupons | Marquee promotes codes that don't exist |
| No payments integration | Checkout is decorative |
| No notifications | Status changes are silent |
| No wishlist, reviews, custom orders | Several core pages have no API |
| No PDF invoices | Customer can't download invoice |
| JWT in `Authorization: Bearer` from localStorage | XSS-vulnerable |
| No rate limiting | Coupon validate + login open to abuse |

---

## 2. Data Model Changes

### 2.1 New Tables

Add to both `sttsadev` and `sttsaprd`. All Azure Table Storage - no Cosmos (per saved memory).

| Table | PartitionKey | RowKey | Purpose |
|---|---|---|---|
| `orderEvents` | `orderId` | `<ISO-timestamp>_<seq>` | Append-only audit log. Single source of truth for §7.9.3 customer timeline and §9.2.2 admin activity feed |
| `ordersByStatus` | `status` | `<ISO-createdAt>_<orderId>` | Secondary index for admin queries (replaces the partition-move hack) |
| `coupons` | `'coupon'` | `code` (uppercased) | Coupon definitions per §8.1 |
| `couponRedemptions` | `code` | `orderId` | Anti-abuse + analytics (§8.5) |
| `announcements` | `'banner'` | `<priority>_<id>` | Marquee items (§6, §9.15) |
| `wishlist` | `userEmail` | `productId` | §7.9.5 |
| `reviews` | `productId` | `reviewId` | §7.11, public read, moderated write |
| `customOrders` | `'inbox'` | `<status>_<inquiryId>` | §7.5 submissions, admin Kanban (§9.8) |
| `addresses` | `userEmail` | `addressId` | §7.9.6, with `isDefault` flag |
| `notifications` | `userEmail` | `<ISO-timestamp>_<channel>` | Outbox-pattern record of every WhatsApp/email/SMS sent - for audit + dedup |
| `staff` | `'admin'` | `username` | Extends current `admins` with `role`, `permissions[]`, `invitedBy`, `lastLoginAt` (§9.14) |
| `auditLog` | `'admin'` | `<ISO-timestamp>_<staffId>` | Every admin write action - required for staff role accountability |

### 2.2 Schema additions to existing tables

**`orders`** - new columns (all nullable for back-compat):

```
userEmail          string?    NEW - owner; '' or 'guest' for guests
status             string     NEW - replaces partitionKey as source-of-truth
couponCode         string?
discountAmount     number?
trackingNumber     string?
courier            string?
courierUrl         string?
eta                string?    ISO datetime
cancelReason       string?
holdReason         string?
razorpayOrderId    string?
razorpayPaymentId  string?
gstAmount          number?
invoiceUrl         string?    blob URL after PDF generation
returnRequestedAt  string?
refundedAt         string?
refundAmount       number?
```

**`users`** - new columns:

```
dob                string?    YYYY-MM-DD for birthday coupons
loyaltyTier        string?    'silver' | 'gold' | 'platinum'
lifetimeValue      number?    accumulated, set on order DELIVERED
prefWhatsapp       boolean?   default true
prefEmail          boolean?   default true
prefPush           boolean?   default false
deletedAt          string?    soft-delete
```

**`admins`** - extend toward `staff` schema:

```
role               'owner' | 'manager' | 'support' | 'readonly'
permissions        string     JSON array of granular perms
invitedBy          string?
lastLoginAt        string?
isActive           boolean
```

### 2.3 Storage Queues

Create in both storage accounts:

| Queue | Producers | Consumer |
|---|---|---|
| `notifications-out` | order state machine, timer functions | `processNotification` (queue trigger) |
| `webhooks-in` | Razorpay webhook, courier webhook | `processWebhook` (queue trigger) |
| `review-requests` | scheduler (3 days after DELIVERED) | `sendReviewRequest` (queue trigger) |
| `order-events-fanout` | order state machine | reserved for V2 (search indexer) |

Visibility timeout: 5 min. Max dequeue: 5 (then dead-letter via poison queue auto-created by runtime).

---

## 3. Refactor: Orders PK Strategy

Today: `orders.partitionKey = status`, and `updateOrderStatus` upserts into new partition + deletes old. The comment in [tableStorage.ts:114-116](backend/src/services/tableStorage.ts#L114-L116) already acknowledges the duplicate-row failure mode. With 12 statuses this becomes untenable.

### 3.1 New scheme

```
orders
  partitionKey = userEmail  (or 'guest' for guest checkouts)
  rowKey       = orderId
  status       = column

ordersByStatus  (secondary index, eventually consistent)
  partitionKey = status
  rowKey       = ISO-createdAt_orderId   ← reverse-sortable
  ... mirror of indexable fields ...
```

### 3.2 Why

| Benefit | Today | After |
|---|---|---|
| `GET /api/orders/me` | full-table scan | single-partition query |
| Status update | upsert + delete (2 ops, duplicate risk) | single merge update |
| Admin filter by status | full-table scan + in-memory filter | single-partition query on `ordersByStatus` |
| Audit log | none | `orderEvents` table is the truth |
| Transition guards | scattered in `orderAdmin.ts` | centralized in `services/orderState.ts` |

### 3.3 Maintenance of `ordersByStatus`

Every status transition writes:
1. `orders` row - set new `status`, update `updatedAt`.
2. `ordersByStatus` - delete old `(oldStatus, ISO_orderId)` row, insert new `(newStatus, ISO_orderId)` row.
3. `orderEvents` - append immutable event row.

All three in a try/catch with explicit logging. Failures of (2) are non-fatal (admin list query just shows stale row briefly) and reconciled by a nightly timer (§11). Failure of (1) or (3) is fatal - rollback the others or alert.

### 3.4 Migration

One-off script (`scripts/migrate-orders.ts`):
1. Read every row from `orders`.
2. For each: rewrite with `partitionKey = userEmail || 'guest'`, `status = oldPartitionKey`, keep `rowKey = orderId`.
3. Populate `ordersByStatus` from the new rows.
4. Backfill `orderEvents` with a synthetic `MIGRATED` event per existing order.

Run in DEV first; verify; then PRD inside a 30-min maintenance window.

---

## 4. HTTP Functions - Customer Side

### 4.1 Orders

| Route | Method | Status | Notes |
|---|---|---|---|
| `api/orders` | POST | **CHANGE** | Re-validate coupon, recompute discount + total server-side, bind to logged-in user via cookie, append `PLACED` event |
| `api/orders/me` | GET | **NEW** | List orders for current user via `userGuard` |
| `api/orders/{id}` | GET | **CHANGE** | Currently admin-only ([orders.ts:103](backend/src/functions/orders.ts#L103)) - allow owner OR admin |
| `api/orders/{id}/events` | GET | **NEW** | Owner-only timeline (drives `/account/orders/[id]`) |
| `api/orders/{id}/cancel` | POST | **NEW** | Allowed when status ∈ {PLACED, CONFIRMED, CRAFTING}; requires reason |
| `api/orders/{id}/address` | PATCH | **NEW** | Allowed when status = PLACED only; one edit per order |
| `api/orders/{id}/issue` | POST | **NEW** | Body: `{ kind: 'damaged'|'wrong'|'missing'|'other', note, photos[] }`; creates support ticket |
| `api/orders/{id}/return` | POST | **NEW** | Allowed when status = DELIVERED and delivered ≤ 7 days ago |
| `api/orders/{id}/invoice` | GET | **NEW** | Streams PDF (or returns SAS URL to blob); regenerates if missing |
| `api/orders/{id}/track-link` | GET | **NEW** | Returns short-lived signed JWT URL - shareable kiosk-style tracker |
| `api/orders/track/{token}` | GET | **NEW** | Public read of a single order via signed token (powers `/account/orders/[id]/track`) |

### 4.2 Other customer endpoints

| Route | Method | Notes |
|---|---|---|
| `api/wishlist` | GET/POST/DELETE | per-user, partition by email |
| `api/addresses` | GET/POST/PATCH/DELETE | per-user, with `isDefault` enforcement |
| `api/reviews` | POST | gated: only if user has DELIVERED order containing this product |
| `api/reviews/product/{id}` | GET | public - moderated reviews only |
| `api/custom-orders` | POST | anonymous OK; rate-limited; creates inquiry + queues notification to admin |
| `api/auth/logout` | POST | **NEW** - clears `tsa_token` cookie |
| `api/auth/me` | GET | **NEW** - returns current user from cookie (replaces frontend `getToken()` localStorage read) |
| `api/auth/csrf` | GET | **NEW** - issues a CSRF token (double-submit pattern) |

---

## 5. HTTP Functions - Admin Side

### 5.1 Orders - the operational nerve centre (§9.2)

| Route | Method | Status | Notes |
|---|---|---|---|
| `api/admin/orders` | GET | **CHANGE** | Extend [orderAdmin.ts:8](backend/src/functions/orderAdmin.ts#L8) with `?status=&from=&to=&payment=&q=&page=&size=`; query `ordersByStatus` |
| `api/admin/orders/{id}` | GET | **NEW** | Full detail incl. events, items, address, payment |
| `api/admin/orders/{id}/status` | PATCH | **CHANGE** | Today it's `PUT` and accepts `{currentStatus,newStatus}` ([orderAdmin.ts:43](backend/src/functions/orderAdmin.ts#L43)); change to `PATCH` with body `{ to, note?, notifyCustomer?, tracking?, courier? }`. Goes through `services/orderState.ts` - validates transition, writes event, enqueues notification |
| `api/admin/orders/{id}/notes` | POST | **NEW** | Internal admin note → `orderEvents` row with `channel: 'internal'` |
| `api/admin/orders/{id}/refund` | POST | **NEW** | Calls Razorpay refund API, writes `REFUND` event, updates `refundedAt` + `refundAmount` |
| `api/admin/orders/{id}/message` | POST | **NEW** | Send WhatsApp/email via templates; logs to `notifications` table |
| `api/admin/orders/{id}/events` | GET | **NEW** | Admin view of full activity log (includes internal notes hidden from customer) |
| `api/admin/orders/bulk-status` | PATCH | **NEW** | Body: `{ ids[], to, note?, notifyCustomer? }` - loops with allowed-transition check |
| `api/admin/orders/{id}/invoice` | POST | **NEW** | Force regenerate invoice PDF |

### 5.2 Other admin endpoints

| Route | Method | Notes |
|---|---|---|
| `api/admin/customers` | GET | search, lifetime value, order count |
| `api/admin/customers/{email}` | GET/PATCH | profile + tags + notes |
| `api/admin/reviews` | GET | moderation queue |
| `api/admin/reviews/{id}` | PATCH | approve/hide/reply |
| `api/admin/custom-orders` | GET | Kanban-style listing |
| `api/admin/custom-orders/{id}` | PATCH | status (New → Quoted → Approved → In Progress → Completed) |
| `api/admin/inventory` | GET | low-stock view |
| `api/admin/inventory/{productId}` | PATCH | qty adjust |
| `api/admin/collections` | GET/POST | curated bundles |
| `api/admin/collections/{id}` | GET/PATCH/DELETE | |
| `api/admin/categories` | GET/POST | |
| `api/admin/categories/{id}` | PATCH/DELETE | |
| `api/admin/staff` | GET/POST | invite admins with roles |
| `api/admin/staff/{username}` | PATCH/DELETE | |
| `api/admin/settings/{key}` | GET/PUT | thin wrapper over existing `config` table |
| `api/admin/analytics/sales` | GET | revenue/AOV/conversion over date range |
| `api/admin/analytics/products` | GET | top sellers, slow movers |
| `api/admin/analytics/customers` | GET | cohort retention |
| `api/admin/audit-log` | GET | from `auditLog` table |

---

## 6. HTTP Functions - Coupons

New file `backend/src/functions/coupons.ts` + `couponAdmin.ts`.

### 6.1 Endpoints

| Route | Method | Notes |
|---|---|---|
| `api/coupons/active` | GET | Public - codes currently valid for the customer's cart context (no codes for first-time-only if user has prior orders) |
| `api/coupons/validate` | POST | Public - `{ code, items[], userId? }` → `{ valid, discount, message }` per §8.4 of new-frontend.md. **Rate limit: 5/min/IP, 20 failures/hour/IP → temp block.** |
| `api/admin/coupons` | GET, POST | List + create |
| `api/admin/coupons/{code}` | GET, PATCH, DELETE | |
| `api/admin/coupons/{code}/redemptions` | GET | from `couponRedemptions` table |
| `api/admin/coupons/{code}/test` | POST | Simulator - same input as validate but without redemption side-effect |

### 6.2 Critical security rules

1. **Never trust client discount.** `POST /api/orders` re-runs validation against the `coupons` table and recomputes. Reject if `clientTotal !== serverTotal` (tolerance: 0).
2. **First-time-only enforcement** via `couponRedemptions` lookup keyed by `userEmail` or `customerPhone`.
3. **Stacking** rejected unless both coupons have `stackable: true` (max 2).
4. **Rate limiting** via `services/rateLimit.ts` - Table Storage counter keyed by IP, 5-min sliding window.
5. **Marquee ↔ coupon sync** - when admin toggles "Promote in announcement bar", a row in `announcements` is created/updated with the coupon code embedded.

---

## 7. HTTP Functions - Announcement Bar

New file `backend/src/functions/announcements.ts`.

| Route | Method | Notes |
|---|---|---|
| `api/announcements` | GET | Public - returns only items where `active=true && now ∈ [startDate, endDate]`, ordered by `priority`. Cached 60s at edge (or in App Insights - see §16). |
| `api/admin/announcements` | GET, POST | |
| `api/admin/announcements/{id}` | GET, PATCH, DELETE | |
| `api/admin/announcements/{id}/preview` | GET | Returns rendered preview HTML for the admin "preview on site" iframe |

Body fields: `message`, `link`, `startDate`, `endDate`, `priority`, `theme` (`gold|festive-pink|muted`), `active`, `linkedCouponCode?`.

---

## 8. HTTP Functions - Other New Endpoints

### 8.1 Payments (Razorpay)

New file `backend/src/functions/payments.ts`.

| Route | Method | Notes |
|---|---|---|
| `api/payments/create-order` | POST | Creates Razorpay order, returns `{ orderId, amount, key }` for Razorpay SDK |
| `api/payments/verify` | POST | Verifies signature, updates `orders.paymentStatus`, transitions order to CONFIRMED |
| `api/payments/webhook` | POST | Razorpay webhook - payment.captured / payment.failed / refund.processed - signature-verified, queues to `webhooks-in` |

### 8.2 Courier integration

New file `backend/src/functions/courier.ts`.

| Route | Method | Notes |
|---|---|---|
| `api/admin/courier/quote` | POST | Get rate + ETA for a pincode pair (Shiprocket API) |
| `api/admin/courier/ship` | POST | Create shipment, get tracking #, attach to order |
| `api/courier/webhook` | POST | Inbound - Shiprocket/Delhivery status updates → queue → state machine |

### 8.3 Invoices

New file `backend/src/functions/invoice.ts` - `pdfkit` based, GST-compliant template.

| Route | Method | Notes |
|---|---|---|
| `api/orders/{id}/invoice` | GET | Owner or admin. Generates on first hit, caches to blob `invoices/{orderId}.pdf` |

### 8.4 Upload extensions

Existing `upload.ts` handles admin product images. Extend or add:

| Route | Method | Notes |
|---|---|---|
| `api/upload/customer` | POST | Authenticated customers - for `/orders/.../issue` photos + custom-order reference images. 5 MB cap. |
| `api/upload/review` | POST | Authenticated, post-delivery - review photos |

All customer-uploaded blobs go to container `user-uploads/{userEmail}/{uuid}.{ext}` with private access; admin moderates.

---

## 9. Auth: Move JWT to httpOnly Cookie

Current state ([services/auth.ts:7](backend/src/services/auth.ts#L7)): JWT returned in response body, frontend stores in `localStorage`, sends as `Authorization: Bearer`. XSS-vulnerable.

### 9.1 Backend changes

1. **New helper in `services/auth.ts`:**

```ts
export function buildAuthCookie(token: string, isAdmin = false): string {
  const maxAge = isAdmin ? 24 * 60 * 60 : 7 * 24 * 60 * 60
  const domain = process.env.COOKIE_DOMAIN ? `; Domain=${process.env.COOKIE_DOMAIN}` : ''
  return `tsa_token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}${domain}`
}
export function buildClearCookie(): string {
  return 'tsa_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'
}
```

2. **Update `userLogin`, `userRegister`, `googleAuth`, `adminLogin`** - set `Set-Cookie` header in response, *still* return token in body during transition (V1) so existing frontend works, then drop body-token in V2.

3. **Update `userGuard` and `adminGuard`** - read cookie first via `request.headers.get('cookie')`, fall back to `Authorization: Bearer` header.

4. **New `POST /api/auth/logout`** - returns `buildClearCookie()` header.

5. **New `GET /api/auth/me`** - returns current user JSON from cookie.

6. **CSRF protection** (cookies now sent automatically):
   - Double-submit pattern: `GET /api/auth/csrf` issues `tsa_csrf=<random>` cookie + same value in JSON response.
   - Frontend echoes the value in `X-CSRF-Token` header on every mutating request.
   - Middleware `csrfGuard` rejects non-GET requests where header ≠ cookie.
   - Skip for webhook routes (they're signature-verified).

### 9.2 Frontend changes (touchpoint, detail in new-frontend.md §11)

- Replace `localStorage.getItem('tsa_token')` reads with `fetch('/api/auth/me', { credentials: 'include' })`.
- Every `fetch` adds `credentials: 'include'` and `X-CSRF-Token` header.
- Delete `setToken/getToken/clearToken` from `lib/auth.ts`.

### 9.3 Required infra changes

- Custom domain for both SWA + Function App on the same root (`thesrilathaarts.com`) so the cookie's `Domain=.thesrilathaarts.com` works.
- `az functionapp cors update --allow-credentials true`.
- App setting `COOKIE_DOMAIN=.thesrilathaarts.com` (PRD only; empty in DEV).

---

## 10. Shared Services

New files under `backend/src/services/`:

| File | Purpose |
|---|---|
| `queue.ts` | Wrap `@azure/storage-queue` for `notifications-out`, `webhooks-in`, `review-requests` |
| `orderState.ts` | **Pure** state-machine: `canTransition(from, to)`, `nextValidStates(from)`, `defaultNotifyChannels(transition)`. 100% unit-tested. |
| `whatsapp.ts` | WhatsApp Cloud API client (Meta Business). Send template messages with `customerName`, `orderId`, `trackingUrl`. |
| `email.ts` | Azure Communication Services Email client. Same templating. |
| `sms.ts` | (V2) MSG91 or ACS SMS for OTP |
| `razorpay.ts` | `createOrder`, `verifySignature`, `refund` |
| `courier.ts` | Shiprocket client (auth token caching, create shipment, fetch tracking) |
| `pdf.ts` | `generateInvoice(order, items)` → Buffer; uses `pdfkit` (no headless Chrome on Consumption plan - too heavy) |
| `rateLimit.ts` | `checkAndIncrement(key, limit, windowSec)` → `{ allowed, remaining }`. Table-Storage-backed sliding window counter. |
| `csrf.ts` | Issue + verify CSRF tokens |
| `templates.ts` | Notification template rendering (Handlebars-style `{{var}}`). Reads templates from `config` table - admin-editable in §9.14 |

---

## 11. Queue & Timer Functions

### 11.1 Queue triggers

| Function | Queue | Action |
|---|---|---|
| `processNotification` | `notifications-out` | Read `{ userEmail, channel, templateKey, vars }`, render via `templates.ts`, dispatch via `whatsapp.ts`/`email.ts`, log to `notifications` table |
| `processWebhook` | `webhooks-in` | Read `{ source, payload }`, dispatch to Razorpay or courier handler |
| `sendReviewRequest` | `review-requests` | Render template, send WhatsApp + email |

### 11.2 Timer triggers

| Function | Schedule | Action |
|---|---|---|
| `scheduleReviewRequests` | Daily 10:00 IST | Find orders DELIVERED ≥ 3 days ago without review request → enqueue |
| `expireAbandonedOrders` | Hourly | Cancel PLACED orders > 24h old with no payment captured |
| `reconcileOrdersByStatus` | Daily 02:00 | Verify `ordersByStatus` index matches `orders.status` - fix drift |
| `cleanupRateLimitCounters` | Daily 03:00 | Drop counter rows older than 1 day |
| `loyaltyTierRecompute` | Weekly Mon 02:00 | Update `users.loyaltyTier` based on `lifetimeValue` |

---

## 12. Order State Machine

Codified in `services/orderState.ts`. Imported by:
- `POST /api/orders` (entry → PLACED)
- `PATCH /api/admin/orders/{id}/status` (any admin transition)
- `POST /api/payments/verify` (PLACED → CONFIRMED on payment captured)
- `processWebhook` (courier updates → SHIPPED, OUT_FOR_DELIVERY, DELIVERED)

### 12.1 Allowed transitions

```ts
const ALLOWED: Record<Status, Status[]> = {
  PLACED:           ['CONFIRMED', 'CANCELLED', 'ON_HOLD'],
  CONFIRMED:        ['CRAFTING',  'CANCELLED', 'ON_HOLD'],
  CRAFTING:         ['PACKED',    'CANCELLED', 'ON_HOLD'],
  PACKED:           ['SHIPPED',   'ON_HOLD'],
  SHIPPED:          ['OUT_FOR_DELIVERY', 'DELIVERED'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED:        ['RETURN_REQUESTED'],
  RETURN_REQUESTED: ['RETURNED', 'DELIVERED'],   // 'DELIVERED' means admin rejected return
  RETURNED:         ['REFUNDED'],
  REFUNDED:         [],
  CANCELLED:        [],
  ON_HOLD:          ['CONFIRMED', 'CRAFTING', 'PACKED', 'CANCELLED'],   // resumes whichever it was on
}
```

### 12.2 Side effects per transition

| To | Required field | Customer notification | Internal notification |
|---|---|---|---|
| `CONFIRMED` | – | WhatsApp + email | – |
| `CRAFTING` | – | WhatsApp | – |
| `PACKED` | – | – (silent) | Slack/email to fulfilment |
| `SHIPPED` | **tracking** + **courier** required | WhatsApp + email | – |
| `OUT_FOR_DELIVERY` | – | WhatsApp + push | – |
| `DELIVERED` | – | WhatsApp + schedule review +72h | – |
| `CANCELLED` | **cancelReason** | WhatsApp + email | – |
| `ON_HOLD` | **holdReason** | WhatsApp | – |
| `REFUNDED` | **refundAmount** + Razorpay txn | WhatsApp + email | – |

The transition function enforces required fields - reject with 400 if missing.

---

## 13. Server-Side Validation Hardening

Extend the pattern already in [orders.ts:30-44](backend/src/functions/orders.ts#L30-L44) (authoritative price lookup from DB - good). New rules for `POST /api/orders`:

1. **Validate every product** against DB price + stock.
2. **Validate coupon** server-side via the same code path as `POST /api/coupons/validate`.
3. **Recompute shipping** - free-ship coupon can override `freeAbove` threshold.
4. **Recompute discount + total.** Reject if `clientTotal !== serverTotal` (or omit clientTotal from API entirely - preferred).
5. **Stock decrement** - atomic update. If concurrent orders race the last unit, second order fails with `OUT_OF_STOCK` before payment.
6. **Bind to user** - if request has valid `tsa_token` cookie, set `userEmail`. Guest orders get `userEmail = 'guest'`.
7. **Initial event** - write `PLACED` event to `orderEvents`.
8. **Razorpay order** created in same handler, returned in response for client SDK to pop the gateway modal.

---

## 14. Azure Infrastructure Changes

Per saved infra notes (verified 2026-05-11), DEV is healthy. PRD has stale Cosmos settings (cleanup in §15). Both RG names: `rg-tsa-dev` / `rg-tsa-prd`. No new Function App, no new Storage account, no Cosmos.

### 14.1 Storage - additions only

In both `sttsadev` and `sttsaprd`:

**Tables** (create if not exists):
```
orderEvents, ordersByStatus, coupons, couponRedemptions, announcements,
wishlist, reviews, customOrders, addresses, notifications, staff, auditLog
```

**Queues:**
```
notifications-out, webhooks-in, review-requests
```

**Blob containers:**
```
invoices         (private, admin + owner read via SAS)
user-uploads     (private, moderated)
```

Existing `images` container stays as-is.

### 14.2 Key Vault - new secrets

Add to both `kv-tsa-dev` and `kv-tsa-prd`:

| Secret | For |
|---|---|
| `RazorpayKeyId` | payments |
| `RazorpayKeySecret` | payments |
| `RazorpayWebhookSecret` | webhook signature verify |
| `WhatsAppCloudApiToken` | Meta Business - long-lived |
| `WhatsAppPhoneNumberId` | Meta Business |
| `WhatsAppWebhookVerifyToken` | inbound webhook handshake |
| `EmailSenderConnString` | Azure Communication Services |
| `ShiprocketEmail` | courier |
| `ShiprocketPassword` | courier |
| `CsrfSigningKey` | new auth flow |
| `GoogleClientSecret` | verify it exists for existing Google OAuth |

### 14.3 Function App settings (Key Vault references)

Add to `func-tsa-dev` and `func-tsa-prd`:

```
RAZORPAY_KEY_ID            @Microsoft.KeyVault(SecretUri=https://kv-tsa-{env}.vault.azure.net/secrets/RazorpayKeyId/)
RAZORPAY_KEY_SECRET        @Microsoft.KeyVault(...)
RAZORPAY_WEBHOOK_SECRET    @Microsoft.KeyVault(...)
WHATSAPP_TOKEN             @Microsoft.KeyVault(...)
WHATSAPP_PHONE_ID          @Microsoft.KeyVault(...)
WHATSAPP_VERIFY_TOKEN      @Microsoft.KeyVault(...)
EMAIL_CONNECTION_STRING    @Microsoft.KeyVault(...)
SHIPROCKET_EMAIL           @Microsoft.KeyVault(...)
SHIPROCKET_PASSWORD        @Microsoft.KeyVault(...)
CSRF_SIGNING_KEY           @Microsoft.KeyVault(...)

NOTIFICATIONS_QUEUE_NAME   notifications-out
WEBHOOKS_QUEUE_NAME        webhooks-in
REVIEW_QUEUE_NAME          review-requests
COOKIE_DOMAIN              .thesrilathaarts.com    (PRD only - empty/unset in DEV)
INVOICE_CONTAINER          invoices
USER_UPLOAD_CONTAINER      user-uploads
```

### 14.4 New Azure resource: Communication Services

For transactional email. Cheaper than SendGrid at low volume, stays inside Azure billing.

```
Resource: acs-tsa-prd (in rg-tsa-prd)
          acs-tsa-dev (in rg-tsa-dev)
Domain:   mail.thesrilathaarts.com  (custom - needs SPF/DKIM CNAMEs)
```

MSI grant: `func-tsa-{env}` MSI → `Communication Services Contributor` on `acs-tsa-{env}`.

### 14.5 MSI / RBAC additions

You already have on `sttsadev`: Storage Blob/Table/Queue Data Contributor (verified). Queues work without further grants.

Add:
- `func-tsa-{env}` MSI → `acs-tsa-{env}` as `Communication Services Contributor`.
- Verify `func-tsa-{env}` MSI → `kv-tsa-{env}` has `Key Vault Secrets User` (likely already there for existing `JwtSecret` reference).

### 14.6 CORS

Per saved gotcha #2 (OPTIONS intercepted at platform level), platform CORS is mandatory.

```
az functionapp cors add --name func-tsa-prd --resource-group rg-tsa-prd \
  --allowed-origins https://www.thesrilathaarts.com https://thesrilathaarts.com

az functionapp cors update --name func-tsa-prd --resource-group rg-tsa-prd \
  --allow-credentials true
```

DEV already configured for `http://localhost:3000` + `proud-flower-...azurestaticapps.net`. Add `--allow-credentials true` to DEV too - required for the new cookie auth.

### 14.7 Static Web App config

Update `staticwebapp.config.json` in repo:

```json
{
  "routes": [
    { "route": "/admin/*", "allowedRoles": ["authenticated"] },
    { "route": "/account/*", "allowedRoles": ["authenticated"] },
    { "route": "/api/*", "rewrite": "https://api.thesrilathaarts.com/api/*" }
  ],
  "globalHeaders": {
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Referrer-Policy": "same-origin",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'self'; img-src 'self' https://*.blob.core.windows.net data:; ..."
  }
}
```

Auth gating at SWA level is belt-and-braces - the real check is in API middleware.

### 14.8 Custom domains (PRD only - flagged pending in your notes)

When wiring `thesrilathaarts.com`:

| Host | Points to |
|---|---|
| `www.thesrilathaarts.com` | `swa-tsa-prd` |
| `thesrilathaarts.com` (apex) | `swa-tsa-prd` via ALIAS/CNAME-flattening |
| `api.thesrilathaarts.com` | `func-tsa-prd` (custom domain on Function App, managed cert) |
| `mail.thesrilathaarts.com` | ACS - SPF/DKIM only |

Cookies set with `Domain=.thesrilathaarts.com` then work across SWA + API.

### 14.9 Optional / V2: API Management + Front Door

| Resource | When |
|---|---|
| `apim-tsa-prd` (Consumption tier) | If coupon-stuffing or login brute-force becomes a problem. Adds ~30 ms but built-in rate limit policy + caching. |
| Azure Front Door + WAF | For festival traffic spikes. Edge cache for `/api/announcements` and `/api/products`. Global. |

Both are V2 - don't pay for them at launch.

---

## 15. PRD Cleanup Checklist

From saved memory: PRD has stale Cosmos settings, missing core app settings. **Do this before adding any new feature settings:**

1. Remove from `func-tsa-prd` app settings: any `cosmos-*`, `Cosmos*`, `COSMOS_*`.
2. Remove from `kv-tsa-prd`: `cosmos-endpoint`, `cosmos-primary-key`, `storage-prd-connstr` (stale).
3. Add to `kv-tsa-prd`: `JwtSecret`.
4. Add to `func-tsa-prd` app settings: `JWT_SECRET` (KV ref), `BLOB_BASE_URL=https://sttsaprd.blob.core.windows.net`, `CORS_ORIGIN=https://www.thesrilathaarts.com`, `AZURE_STORAGE_ACCOUNT_NAME=sttsaprd`, all `AzureWebJobsStorage__*` entries matching DEV pattern.
5. Run platform CORS command from §14.6.
6. Verify MSI RBAC on `sttsaprd` - `Storage Blob/Table/Queue Data Contributor` (same as DEV).
7. Smoke-test: deploy current backend to PRD, confirm `/api/products` returns 200.

This is the gate that needs to pass before any new feature ships to PRD.

---

## 16. Observability & Alerts

### 16.1 App Insights alerts (both envs)

| Alert | Trigger |
|---|---|
| Function errors | `severityLevel >= 3` traces > 5/min |
| Order create failure | `POST /api/orders` non-2xx > 2/hour |
| Razorpay webhook failure | `payments.webhook` non-2xx > 1 |
| Courier webhook failure | `courier/webhook` non-2xx > 1 |
| Queue dead-letter | any message in `*-poison` queue |
| Coupon validate spike | `/api/coupons/validate` > 1000/min (potential brute-force) |
| Stock-out race | `OUT_OF_STOCK` errors > 5/hour (signals popular item without enough stock) |

### 16.2 Dashboards (App Insights Workbooks)

1. **Order funnel** - cart created → checkout started → paid → shipped → delivered. Drop-off %s.
2. **Coupon performance** - per code: views, validations, redemptions, GMV.
3. **Announcement bar** - impressions, clicks, dismissals.
4. **Live operations** - last 24h orders by status, pending fulfilment, ETA breaches.

### 16.3 Logging discipline

- Use structured logging (`context.log` with object payload).
- Never log full JWT, full Razorpay signatures, customer phone (last 4 digits OK).
- Every order state transition logs: `{ orderId, from, to, by, byRole, took_ms }`.

---

## 17. Migration Strategy

### 17.1 Stage 1 - additive only (zero customer impact)

1. Create new tables + queues.
2. Deploy new functions for: coupons, announcements, wishlist, reviews, custom-orders.
3. Add new app settings + Key Vault secrets.
4. Verify all in DEV.
5. Apply PRD cleanup (§15).
6. Promote to PRD.

### 17.2 Stage 2 - orders schema migration

1. Deploy new orders code reading both old (partition=status) and new (partition=email) shapes - feature flag controlled.
2. Run `scripts/migrate-orders.ts` in DEV; verify.
3. Run in PRD inside a 30-min maintenance window with banner: *"Brief site maintenance - back in 30 minutes."*
4. Flip feature flag.
5. After 7 days clean, remove old code path.

### 17.3 Stage 3 - auth migration to cookie

1. Backend supports BOTH cookie and Authorization header. Both endpoints set Set-Cookie *and* return token in body.
2. Frontend switches reads to `/api/auth/me`. Keeps writes to localStorage for now.
3. Wait 14 days for all active sessions to age out / users to log back in.
4. Frontend stops reading localStorage; clears it once.
5. Backend stops returning token in body.
6. Add CSRF guard middleware.

### 17.4 Stage 4 - payment cutover

1. Razorpay test-mode keys in DEV. End-to-end test with their test cards.
2. PRD: switch to live keys via Key Vault. COD remains available as fallback.
3. Monitor first 50 transactions closely.

---

## 18. Phased Delivery

Matches frontend Phased Roadmap (§16 of new-frontend.md).

### Phase 1 - Foundation backend (Weeks 1–2)

- Announcement bar endpoints + admin CRUD.
- New `orderEvents` table + state-machine service (no behaviour change yet).
- Move `GET /api/orders/{id}` to owner-OR-admin auth.
- `GET /api/orders/me`.

### Phase 2 - Commerce + Order Management (Weeks 3–4)

- Orders schema migration (Stage 2 above).
- Status workflow expansion to 12 statuses.
- Customer order endpoints: cancel/address/issue/return/invoice/track-link.
- Admin order endpoints: status PATCH, notes, refund, message, bulk-status, events.
- Coupon validate + admin CRUD.
- Razorpay integration + webhook.
- WhatsApp Cloud API + ACS Email + notification queue.
- Cookie auth + CSRF (Stage 3 above).

### Phase 3 - Custom Orders + Reviews (Week 5)

- `customOrders` table + endpoints (public POST + admin Kanban).
- `reviews` table + endpoints (gated POST, moderation).
- Wishlist + addresses endpoints.

### Phase 4 - Admin Expansion (Weeks 6–7)

- Inventory, collections, categories endpoints.
- Staff + audit-log endpoints.
- Analytics endpoints (revenue, AOV, top sellers).
- Shiprocket courier integration + webhook.

### Phase 5 - Polish (Week 8)

- Rate limiting on coupons/validate + login.
- Review-request scheduler.
- Reconciliation timer for `ordersByStatus` drift.
- App Insights alerts + workbooks.
- WhatsApp templates editable in admin.

### Phase 6 (V2)

- APIM with rate-limit policies.
- Front Door + WAF.
- Search indexer (Azure AI Search) for product full-text.
- SMS OTP for guest checkout.

---

**End of plan.** Pairs with [new-frontend.md](new-frontend.md). Both documents share the order-state contract (§12 here = §7.9.9 / §9.2.3 there), the coupon contract (§6 here = §8 there), and the announcement contract (§7 here = §6 there).
