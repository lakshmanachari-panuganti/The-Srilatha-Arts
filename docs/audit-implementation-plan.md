# Codebase Audit & Implementation Plan
**Date:** 2026-05-14
**Scope:** Full-stack audit - backend (Azure Functions/TypeScript), frontend (Next.js), infra config
**Status:** Pre-production - critical and high issues must be resolved before launch

---

## Table of Contents
1. [Summary](#summary)
2. [Issues by Severity](#issues-by-severity)
   - [Critical](#critical)
   - [High](#high)
   - [Medium](#medium)
   - [Low](#low)
3. [Implementation Plan (Ordered Fix List)](#implementation-plan)
4. [Unfinished / Placeholder Areas](#unfinished--placeholder-areas)
5. [Missing Test Coverage](#missing-test-coverage)

---

## Summary

| Severity | Count | Notes |
|----------|-------|-------|
| Critical | 6     | +2: H-02 escalated (stock never decremented); C-02 rewritten (CSRF guard never called) |
| High     | 11    | H-02 moved to Critical |
| Medium   | 15    | M-11 removed (false positive); M-03/M-06 already moved to Low |
| Low      | 8     | L-02 removed (false positive); +2 from M-03/M-06 downgrades |
| **Total**| **40**| 2 findings reclassified up; 2 false positives removed; net count unchanged |

**Verification key:**
- ✅ Verified Bug - confirmed by reading actual code/behavior
- ✅ Verified Security Vulnerability - confirmed exploitable path
- ⚠️ Verified Risk - confirmed code path but impact depends on environment/traffic
- 🔴 Missed/Escalated - new finding or escalated severity from code review
- ❌ False Positive - removed after reading actual implementation

---

## Issues by Severity

---

### CRITICAL

---

#### C-01 - No Rate Limiting on Auth Login / Register Endpoints
**File:** `backend/src/functions/userAuth.ts` - `userLogin`, `userRegister`, `googleAuth`
**Description:** The user login, registration, and Google OAuth endpoints have zero rate limiting. The `checkAndIncrement` service exists and is used on coupons, but was never applied to authentication.
**Why Problematic:** Attackers can brute-force passwords at full Azure Functions throughput (thousands of req/sec). Registration spam inflates storage costs.
**Real-world Impact:** Complete account takeover for any account with a weak password; denial of service via account lockout; storage cost amplification.
**Recommended Fix:**
```typescript
// userLogin - add at the top of the handler, after OPTIONS check:
const ip = getClientIp(request)
const rl = await checkAndIncrement(`login_fail:${ip}`, 20, 3_600_000) // 20/hr
if (!rl.allowed) return errorResponse('Too many login attempts. Try again later.', 429, origin)
```
Also add per-email rate limiting: `login_fail:email:${email}` - 5 failures in 15 minutes triggers a 403 with a "too many attempts" message.
**Severity: Critical**

---

#### C-02 - CSRF Protection Infrastructure Exists But Is Never Called 🔴
**Files:** `backend/src/middleware/csrfGuard.ts`, `backend/src/services/csrf.ts`
**Classification:** ✅ Verified Security Vulnerability
**Description:**
`csrfGuard.ts` exports `csrfCheck()` and `csrf.ts` has full token generation/verification logic - but `csrfCheck` is **never imported or called in any endpoint handler**. A global grep for `csrfCheck` returns only its definition; every mutating endpoint (`POST`, `PATCH`, `DELETE`) runs without any CSRF enforcement.

Additionally, the signing key in `csrf.ts` line 12 has a hardcoded fallback:
```typescript
const CSRF_SIGNING_KEY = process.env.CSRF_SIGNING_KEY || 'dev-csrf-key-change-me'
```
If `CSRF_SIGNING_KEY` is not set in production, this well-known string (visible in the repo) would be used to sign tokens - defeating CSRF protection the moment it IS wired in.

**Partial mitigation that exists:**
Auth cookies use `SameSite=Lax`, which blocks standard cross-site form-POST attacks (the cookie is not sent on cross-origin non-navigation requests). However, SameSite=Lax does NOT cover subdomain attacks, certain redirect flows, or very old browser versions.

**Real-world Impact:**
1. Currently: zero CSRF enforcement in code; SameSite=Lax is the only protection.
2. If `CSRF_SIGNING_KEY` is missing in production when someone later wires the guard: the known fallback key means any attacker can forge valid CSRF tokens.

**Recommended Fix:**
```typescript
// Step 1 - csrf.ts: remove fallback
const CSRF_SIGNING_KEY = process.env.CSRF_SIGNING_KEY
if (!CSRF_SIGNING_KEY) throw new Error('CSRF_SIGNING_KEY environment variable is required')

// Step 2 - add to each mutating handler (orders, addresses, auth, reviews, etc.):
const csrfError = csrfCheck(request)
if (csrfError) return errorResponse(csrfError, 403, origin)
```
**Severity: Critical**

---

#### H-03b - JWT Secret Missing Causes Auth System Crash
**File:** `backend/src/services/auth.ts` - line 4
**Description:**
```typescript
const JWT_SECRET = process.env.JWT_SECRET!
```
The TypeScript non-null assertion `!` only satisfies the compiler; it does not throw at runtime. If `JWT_SECRET` is `undefined` at runtime, `jwt.sign()` from `jsonwebtoken` v9 internally calls `createSecretKey(undefined)`, which throws `Error('secretOrPrivateKey is not valid key material')`. This exception propagates up and crashes **every auth endpoint** (register, login, Google auth, token verify) with an unhandled 500.

> **Correction vs. original finding:** The earlier claim that `jsonwebtoken` would silently sign tokens with the string `"undefined"` is **incorrect**. The library explicitly validates the key material and throws before signing. There is no silent forgery - the risk is a **total auth system crash** on misconfigured deployments.

**Why Problematic:** If `JWT_SECRET` is missing from a production environment variable set (e.g., a missed secret in Azure App Settings), every login and registration attempt returns a 500 error. The site's entire auth layer goes dark.
**Real-world Impact:** Complete authentication outage; no user can log in or register; admin panel inaccessible.
**Recommended Fix:** Fail fast at module load time with a clear error message:
```typescript
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set and at least 32 characters')
}
```
**Severity: High** *(downgraded from Critical - the failure mode is a crash, not token forgery)*

---

#### C-04 - Coupon Usage Limit Not Enforced Atomically (Race Condition)
**File:** `backend/src/functions/coupons.ts` - `validateCoupon`; `backend/src/functions/orders.ts` - `createNewOrder`
**Description:** Coupon validation (check usage → return valid) and coupon redemption (increment counter) are two separate, non-atomic operations. The `createNewOrder` function accepts a `couponCode` field but **never validates it or applies a discount** - `discountAmount` is hardcoded to `0`. No coupon redemption is ever recorded.
**Issues:**
1. Two simultaneous checkout requests with the same coupon code both pass the `currentUsage < usageLimit` check before either increments the counter.
2. The order creation does not apply the discount at all - the entire coupon flow is disconnected from order creation.
3. No `CouponRedemption` record is ever written by the order creation flow.
**Real-world Impact:**
- A 1-use promo code can be redeemed by unlimited simultaneous requests.
- Customers applying a coupon at checkout get 0 discount regardless, which breaks the business.
**Recommended Fix:**
- In `createNewOrder`, validate the coupon and compute the discount (reuse logic from `validateCoupon`), then apply it to `totalAmount` and `discountAmount`.
- After successful order creation, atomically increment `coupon.currentUsage` and write a `CouponRedemption` row.
- Consider using an Azure Table optimistic concurrency `etag` check on the coupon row to detect and reject concurrent redemptions.
**Severity: Critical**

---

#### C-05 - Order ID Generated with Math.random() (Non-Unique, Non-Secure)
**File:** `backend/src/functions/orders.ts` - `generateOrderId()`
**Description:**
```typescript
function generateOrderId(): string {
  const year = new Date().getFullYear()
  const seq = Math.floor(Math.random() * 99999).toString().padStart(5, '0')
  return `ORD-${year}-${seq}`
}
```
`Math.random()` is not cryptographically secure and has only 99,999 possible values per year. With enough orders, collisions become statistically likely (birthday problem: $k \approx \sqrt{2N \ln 2} = \sqrt{2 \times 99{,}999 \times 0.693} \approx 372$ - approximately **50% collision probability at ~372 orders/year**). The current format also reveals only the year - the exact placement date is not visible from the order ID alone.
**Why Problematic:** A collision causes `createEntity` to throw an "EntityAlreadyExists" error and the order is lost silently - the customer is charged but no order record is created.
**Real-world Impact:** Data loss; orders silently fail; potential double-charging if payment is taken before order creation.

**Recommended Fix - Date-embedded ID with daily atomic counter:**

Encode the full date (`YYYYMMDD`) directly in the order ID so that the placement date (day, month, year) is instantly readable from the order number itself. Use a **per-day incremental counter** stored in a `counters` Azure Table to guarantee uniqueness with no collisions.

**New format:** `ORD-YYYYMMDD-NNNNN`
- Example: `ORD-20260514-00001` → placed on **14 May 2026**, first order of that day.
- Example: `ORD-20260514-00042` → placed on **14 May 2026**, 42nd order of that day.

The counter resets naturally each day because the row key includes the full date - a new day creates a new counter row starting from 1.

```typescript
// services/tableStorage.ts - add this function
export async function getNextDailyOrderSequence(dateKey: string): Promise<number> {
  // dateKey format: 'YYYYMMDD', e.g. '20260514'
  const client = getTableClient('counters')

  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      // Fetch the existing daily counter
      const entity = await client.getEntity<{ value: number } & TableEntity>('order', dateKey)
      const next = (entity.value ?? 0) + 1
      // Optimistic update - fails with 412 if another request incremented first
      await client.updateEntity(
        { partitionKey: 'order', rowKey: dateKey, value: next },
        'Replace',
        { etag: entity.etag },
      )
      return next
    } catch (err: any) {
      if (err.statusCode === 404) {
        // First order of the day - create the counter row
        try {
          await client.createEntity({ partitionKey: 'order', rowKey: dateKey, value: 1 })
          return 1
        } catch (createErr: any) {
          if (createErr.statusCode !== 409) throw createErr
          // Race: another request created it at the same moment - retry the loop
        }
      } else if (err.statusCode === 412) {
        // ETag conflict - another request incremented concurrently, retry
        continue
      } else {
        throw err
      }
    }
  }
  throw new Error('Failed to generate order sequence after 10 retries')
}

// functions/orders.ts - replace generateOrderId()
async function generateOrderId(): Promise<string> {
  const now = new Date()
  // Build YYYYMMDD in IST (UTC+5:30) so the date matches the customer's calendar day
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
  const dateKey =
    ist.getUTCFullYear().toString() +
    (ist.getUTCMonth() + 1).toString().padStart(2, '0') +
    ist.getUTCDate().toString().padStart(2, '0')   // e.g. '20260514'

  const seq = await getNextDailyOrderSequence(dateKey)
  return `ORD-${dateKey}-${seq.toString().padStart(5, '0')}`
  // Result: 'ORD-20260514-00001'
}
```

**How to read the ID at a glance:**

| Order ID | Date | Sequence |
|----------|------|----------|
| `ORD-20260514-00001` | 14 May 2026 | 1st order of the day |
| `ORD-20260101-00099` | 1 Jan 2026 | 99th order of the day |

Note: `generateOrderId` becomes `async`; update the `createNewOrder` call site accordingly (`const orderId = await generateOrderId()`). The `counters` table requires no manual maintenance - each new date automatically starts a fresh counter row.
**Severity: Critical**

---

#### C-06 - Stock Quantity Is Never Decremented After an Order 🔴
**File:** `backend/src/functions/orders.ts` - `createNewOrder`
**Classification:** ✅ Verified Bug (escalated from H-02 "non-atomic decrement")
**Description:**
`createNewOrder` reads `product.stockQty`, checks if enough units exist, then creates the order - but **never writes back a decremented stock value**. After any order, `product.stockQty` in Table Storage remains at its original value. A grep for `upsertProduct`, `updateProduct`, or any stock decrement in `orders.ts` returns zero results.

The only way to reduce `stockQty` is manually, via the admin `productAdmin` endpoint.

> **Correction vs. original finding (H-02):** The audit described a "non-atomic race condition in stock decrement." The actual situation is worse - there IS no decrement at all. The `inStock` boolean must also be set to `false` manually when stock runs out.

**Real-world Impact:**
- Every product has effectively infinite stock as long as `inStock: true` and `stockQty > 0` were set at creation.
- An artist lists a one-of-a-kind kolam, sets `stockQty: 1`. 10 customers order it simultaneously. All 10 orders succeed because stock is never decremented after order #1.
- The artist must fulfil 10 orders for an item she has 1 of.

**Recommended Fix:**
After successfully creating the order, atomically decrement `stockQty` using an ETag optimistic concurrency check. If the ETag conflicts, roll back the order and return 409:
```typescript
// After createOrder(...) succeeds:
const productClient = getTableClient('products')
const fresh = await productClient.getEntity(product.partitionKey, product.rowKey) as Row
const newQty = (Number(fresh.stockQty) ?? 0) - item.qty
await productClient.updateEntity(
  { partitionKey: fresh.partitionKey, rowKey: fresh.rowKey, stockQty: newQty, inStock: newQty > 0 },
  'Merge',
  { etag: fresh['odata.etag'] },  // 412 if concurrent update → return 409 and delete the order
)
```
**Severity: Critical**

---

### HIGH

---

#### H-01 - Admin Token Stored in localStorage (XSS Vulnerable)
**File:** `frontend/stores/adminAuth.ts`
**Description:** The admin JWT is persisted to `localStorage` via Zustand `persist`. The `logout()` function only clears in-memory state - it never calls `/api/auth/logout` to clear the httpOnly cookie. The Bearer token sent in API calls from localStorage is directly readable by any injected script.
**Why Problematic:** Any XSS vulnerability (in a third-party script, a template, or future code) can steal the admin token from localStorage and impersonate the admin from any machine.
**Real-world Impact:** Complete admin takeover; product manipulation; order fraud; customer data exposure.
**Recommended Fix:**
1. Remove `token` from `partialize` - never persist it to localStorage.
2. Rely solely on the httpOnly cookie for admin sessions (the backend already sets it).
3. Fix `logout()` to call `apiFetch('/auth/logout', { method: 'POST' })` to clear the server-side cookie.
4. Remove `token` from the API response body (the "V1 compat" comment says to drop it - do it now for admin).
**Severity: High**

---

#### H-03 - No Quantity Validation on Order Items
**File:** `backend/src/functions/orders.ts` - `createNewOrder`
**Classification:** ✅ Verified Bug
**Description:** `item.qty` is never validated. A request with `qty: 0`, `qty: -5`, or `qty: 999999` will be accepted.
**Why Problematic:** Negative quantities produce negative subtotals, potentially generating a negative `totalAmount` that could be exploited in payment flows. Extremely large quantities circumvent stock checks.
**Real-world Impact:** Accounting corruption; free or negative-price orders; payment gateway confusion.
**Recommended Fix:**
```typescript
for (const item of body.items) {
  if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > 100) {
    return errorResponse(`Quantity must be between 1 and 100`, 400, origin)
  }
  // ... rest of validation
}
```
**Severity: High**

---

#### H-04 - File Upload Validates Extension Not Content (Magic Bytes)
**File:** `backend/src/functions/upload.ts` - `customerUpload`
**Description:**
1. Content-type is set from file extension: `image/${ext === 'png' ? 'png' : 'jpeg'}` - a `.exe` file renamed to `.jpg` is accepted and stored as `image/jpeg`.
2. The `sharp` library is NOT called in `customerUpload` - the raw buffer is uploaded directly. Only `adminUpload` uses `sharp` (which would reject non-images).
3. `require()` is used inside the function body instead of top-level imports, which prevents tree-shaking and type safety.
**Why Problematic:** Malicious files can be stored in Azure Blob Storage and served from the storage URL, potentially hosting phishing pages or malware under a trusted domain.
**Real-world Impact:** Malware hosting; phishing; reputation damage; potential Azure ToS violation.
**Recommended Fix:**
- Pipe all uploads through `sharp` - it will throw on non-image input.
- Validate file magic bytes before processing.
- Enforce a whitelist of allowed extensions: `['jpg', 'jpeg', 'png', 'webp']`.
- Move all `require()` to top-level imports.
**Severity: High**

---

#### H-05 - `listAll()` Loads Entire Table into Memory
**File:** `backend/src/services/tableStorage.ts` - `listAll()`
**Description:** Every call to `listAll()` iterates the full table with no row limit, loading everything into a JavaScript array in the Azure Function's memory. This is used for `getAllOrders()`, `getAllProducts()`, `getAllReviews()`, `listCoupons()`, `listCustomOrders()`, and more.
**Why Problematic:** As the business grows, this will cause:
- Out-of-memory crashes when the table exceeds the Function's memory limit.
- Timeout failures (Functions have a max execution time).
- O(N²) behavior for paginated admin endpoints (fetch all, then slice in memory).
**Real-world Impact:** Site outage as order volume grows; admin dashboard becomes unusable.
**Recommended Fix:**
- Add a `maxRows` parameter to `listAll()` for admin listing endpoints.
- For customer-facing queries, always use partition-key-scoped queries (already done for user orders - apply same pattern everywhere).
- For admin search, implement server-side continuation tokens using Azure Table's built-in pagination.
**Severity: High**

---

#### H-06 - Duplicate Review Submission Not Prevented
**File:** `backend/src/functions/reviews.ts` - `submitReview`
**Description:** The review gate checks only that the user has a DELIVERED order containing the product. It does not check if the user has already submitted a review for that product. Additionally, the `orderId` stored in the review is always the first DELIVERED order found, not the specific order for this product.
**Why Problematic:** A user can flood a product with fake positive reviews, inflating its rating and making the review system meaningless.
**Real-world Impact:** Rating manipulation; trust erosion; admin moderation overhead.
**Recommended Fix:**
```typescript
// Check for existing review
const existing = await getReviewByUserAndProduct(user.userId, body.productId)
if (existing) {
  return errorResponse('You have already reviewed this product', 409, origin)
}
```
Add `getReviewByUserAndProduct` to tableStorage using a filter on `userEmail eq '...'` within the product partition.
**Severity: High**

---

#### H-07 - Review Username Derived from Email (Privacy Leak)
**File:** `backend/src/functions/reviews.ts` - `submitReview`
**Description:**
```typescript
userName: user.userId.split('@')[0], // fallback; frontend can pass name
```
The user's email local-part (everything before `@`) is used as the public display name. For an email like `ananya.sharma@gmail.com`, the public username becomes `ananya.sharma` - exposing the user's real name from their email.
**Why Problematic:** Violates GDPR Article 5(1)(c) (data minimisation). The frontend comment says "frontend can pass name" but there is no mechanism to receive it.
**Real-world Impact:** Privacy violation; user complaints; GDPR compliance risk.
**Recommended Fix:** Look up the user's registered `name` from the `users` table before creating the review. Pass it down properly.
```typescript
const userRow = await getUser(user.userId)
const userName = userRow?.name || 'Anonymous'
```
**Severity: High**

---

#### H-08 - Admin Logout Does Not Clear httpOnly Cookie
**File:** `frontend/stores/adminAuth.ts` - `logout()`
**Description:** The logout function clears Zustand in-memory state but never calls the backend `/api/auth/logout` endpoint that issues `Set-Cookie: tsa_token=; Max-Age=0`. The httpOnly auth cookie remains valid in the browser for its full 24-hour TTL.
**Why Problematic:** After clicking "Logout", if an attacker gains browser access (shared computer, session hijacking, XSS), the old cookie still authenticates API requests.
**Real-world Impact:** Session persistence after logout; auth bypass on shared devices.
**Recommended Fix:**
```typescript
logout: async () => {
  try { await apiFetch('/auth/logout', { method: 'POST' }) } catch {}
  set({ user: null, token: null, error: null })
},
```
**Severity: High**

---

#### H-09 - Missing Input Sanitization on Free-Text Fields
**File:** `backend/src/functions/addresses.ts`, `customOrders.ts`, `reviews.ts`, `userAuth.ts`
**Description:** The following fields accept arbitrary-length strings with no max-length enforcement:
- `body.customerName` (addresses, orders, customOrders)
- `body.description` (customOrders)
- `body.body` (reviews)
- `body.name` (userAuth registration)
- `body.line1`, `body.city`, `body.state`, `body.pincode` (addresses)

No pincode format validation (should be 6-digit numeric).
**Why Problematic:** Extremely long strings (megabytes) can cause Azure Table Storage to reject the row with an opaque error, cause timeouts, or inflate storage costs. Pincodes stored as any string break address validation downstream.
**Real-world Impact:** Silent data corruption; storage errors; customer support burden.
**Recommended Fix:** Add explicit max-length checks and format validation:
```typescript
if (body.name.length > 100) return errorResponse('Name too long', 400, origin)
if (body.description.length > 2000) return errorResponse('Description too long', 400, origin)
if (!/^\d{6}$/.test(body.pincode)) return errorResponse('Invalid pincode', 400, origin)
```
**Severity: High**

---

#### H-10 - Non-Atomic Order Status Update (Secondary Index Can Drift)
**File:** `backend/src/functions/orderAdmin.ts` - `adminUpdateStatus`
**Classification:** ✅ Verified Bug
**Description:** The status update flow is:
1. `mergeOrder(...)` - updates the primary order row
2. `deleteOrderByStatus(from, ...)` + `upsertOrderByStatus(to, ...)` - updates the secondary index

Step 2 is inside a try/catch with `context.warn('ordersByStatus index update failed', indexErr)`. The error IS logged, but the request still returns 200 to the caller. If step 2 fails after step 1 succeeds, the order appears in the wrong status bucket in the admin dashboard indefinitely.

> **Correction vs. original finding:** The error is not silently swallowed - it IS logged via `context.warn`. However, there is still no nightly reconciliation job to fix accumulated drift.

**Why Problematic:** The admin dashboard's status-filtered view (`/api/admin/orders?status=PLACED`) shows stale data. Orders appear "stuck" in old statuses.
**Real-world Impact:** Missed orders; admin ships an already-cancelled order; customer receives wrong status notifications.
**Recommended Fix:** Implement the reconciliation timer trigger, or at minimum log enough information to fix drift manually. The warn log is a good start but the data for recovery (orderId, from, to) should be included:
```typescript
context.warn('ordersByStatus index drift', { orderId, from, to, error: String(indexErr) })
```
**Severity: High**

---

#### H-11 - Google OAuth Audience Validation Skipped When GOOGLE_CLIENT_ID is Empty
**File:** `backend/src/functions/userAuth.ts` - `googleAuth`
**Description:**
```typescript
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
```
If `GOOGLE_CLIENT_ID` is not set, `verifyIdToken({ audience: '' })` is called. The `google-auth-library` validates that the token's `aud` claim matches the provided audience. With an empty string audience, the validation may pass for any Google token or fail with a confusing error.
**Why Problematic:** Tokens issued to any Google OAuth client could authenticate to this app, allowing cross-app account takeover.
**Recommended Fix:** Fail fast at startup if `GOOGLE_CLIENT_ID` is not configured:
```typescript
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
if (!GOOGLE_CLIENT_ID) throw new Error('GOOGLE_CLIENT_ID is required')
```
**Severity: High**

---

### MEDIUM

---

#### G-01 - Admin Dashboard Uses Hardcoded Mock Data
**Files:** `frontend/app/admin/page.tsx`, `frontend/app/admin/orders/page.tsx`
**Category:** Known Feature Gap (not a bug - intentional placeholder during development)
**Description:** The admin dashboard displays hardcoded statistics ("Total Revenue: ₹12,500", "142 orders", "850 customers") and mock order records. There is no API integration.
**Production Impact:** Admins see fake data while real orders pile up unnoticed. **Must be resolved before go-live.**
**Fix:** Wire up to `GET /api/admin/orders`, `/api/admin/analytics` (to be built), or derive stats from existing endpoints.
**Severity: Medium** (revenue-blocking feature gap)

---

#### G-02 - Checkout and Customer Login Are Placeholder Pages
**Files:** `frontend/app/checkout/page.tsx`, `frontend/app/login/page.tsx`
**Category:** Known Feature Gap (not a bug - explicitly deferred to Phase 2)
**Description:** Both pages show `<PlaceholderPage>` components. The checkout page reads "ships in Phase 2"; the login page reads "lands in Phase 2". These are core user journeys.
**Production Impact:** Users cannot complete purchases or log in - the primary revenue flow is non-functional. **Must be resolved before go-live.**
**Fix:** Implement checkout (Phase 2 priority), customer login (essential for order tracking and reviews), and customer registration UI.
**Severity: Medium** (revenue-blocking feature gap)

---

#### L-07b - `updateOrderStatus` Is Dangerous Dead Code (Remove It)
**File:** `backend/src/services/tableStorage.ts` - `updateOrderStatus()`
**Description:** This function performs a non-atomic delete-then-insert that can leave an order in two partitions simultaneously if the delete step fails. However, **this function is not called anywhere in the current codebase** - `mergeOrder` is used for all status transitions. The risk is theoretical (future developer might use it), not an active runtime bug.

> **Correction vs. original finding:** The original finding was classified Medium as if this were an active bug. It is not - the function is unused. The real risk is that it exists as an attractive but broken pattern for future contributors.

**Fix:** Delete the function. If a migration script needs it, copy it there and keep it out of the shared service layer.
**Severity: Low** *(downgraded from Medium - no current call sites, zero runtime impact)*

---

#### M-04 - Order Event RowKey Collisions Possible
**File:** `backend/src/functions/orders.ts`, `orderAdmin.ts`
**Description:** Order events use `rowKey: ${now}_001`, `${now}_cancel`, `${now}_status`, `${now}_note`. If two events occur at the same ISO timestamp (millisecond resolution), the `createEntity` call will fail or silently overwrite the prior event.
**Fix:** Use `randomUUID().slice(0,8)` as the suffix instead of a fixed string.
```typescript
rowKey: `${now}_${randomUUID().slice(0, 8)}`
```
**Severity: Medium**

---

#### M-05 - Missing X-Frame-Options and Content-Security-Policy Headers
**File:** `frontend/staticwebapp.config.json`
**Description:** The global headers include `Strict-Transport-Security`, `Referrer-Policy`, `X-Content-Type-Options`, and `Permissions-Policy` - but are missing:
- `X-Frame-Options: DENY` - allows the site to be embedded in iframes (clickjacking risk)
- `Content-Security-Policy` - no restriction on script sources (XSS amplification)
- `X-XSS-Protection: 0` - legacy header (should be set to 0 to disable broken browser heuristics)
**Fix:** Add to `globalHeaders`:
```json
"X-Frame-Options": "DENY",
"Content-Security-Policy": "default-src 'self'; img-src 'self' https://*.blob.core.windows.net data:; script-src 'self' 'unsafe-inline' https://accounts.google.com; frame-ancestors 'none';",
"X-XSS-Protection": "0"
```
**Severity: Medium**

---

#### L-07c - Admin Guard Shows Stale UI from localStorage (UX Issue, Not Security)
**File:** `frontend/app/admin/layout.tsx`
**Description:** The admin route guard checks `useAdminAuth().user` from Zustand (backed by localStorage). If someone manually sets a fake user object in localStorage, the admin sidebar renders - but **every single API call hits the backend and returns 401** because no valid httpOnly cookie exists. No real data is ever loaded; no actions can be taken.

> **Correction vs. original finding:** This is not a security vulnerability. The backend authorization is intact and cannot be bypassed this way. The issue is a **UX/stale-state concern**: a legitimately logged-out user might briefly see the admin shell before the 401s clear the state. This scenario occurs naturally after cookie expiry too.

**Fix:** After hydration, call `GET /api/auth/me` to validate the session and sync state - this is good UX practice (avoids stale auth flash) but is not a security requirement.
**Severity: Low** *(downgraded from Medium - no data exposure, no exploitable path)*

---

#### M-07 - Application Insights Excludes All Request Telemetry
**File:** `backend/host.json`
**Description:**
```json
"excludedTypes": "Request"
```
This excludes all HTTP request traces from Application Insights. There are no HTTP request logs, no failed request tracking, and no performance metrics per endpoint.
**Fix:** Remove `"excludedTypes": "Request"` or change to only exclude health check probes. HTTP request telemetry is essential for monitoring, SLA tracking, and incident response.
**Severity: Medium**

---

#### M-08 - Rate Limiter Has a Check-Then-Act Race Condition
**File:** `backend/src/services/rateLimit.ts` - `checkAndIncrement()`
**Classification:** ⚠️ Architectural Decision / Acceptable Approximation
**Description:** The function reads the counter, checks it, then writes the incremented value. Two concurrent requests can both read `count=4` (limit=5), both pass the check, and both write `count=5` - effectively allowing 6 requests instead of 5.

> **Verification note:** `upsertRateLimitCounter` uses `upsertEntity` with no ETag - confirmed. The ±1 approximation is inherent to this design. For the actual use cases (coupon validation at 5/min, auth at 20/hr), allowing 1 extra request per window edge is an **acceptable trade-off** for this traffic scale. This is an architectural decision, not a bug that needs immediate fixing.

**Fix (if tighter limits needed):** Add ETag-based optimistic concurrency to `upsertRateLimitCounter` and retry on 412. For the current scale, documenting the ±1 approximation is sufficient.
**Severity: Medium** *(acceptable by design at current scale; revisit if rate limiting becomes a security-critical control)*

---

#### M-09 - Coupon Type Not Validated on Creation
**File:** `backend/src/functions/coupons.ts` - `adminCoupons` (POST handler)
**Description:** The coupon `type` field is stored directly from the request body with no validation against the allowed enum (`PERCENTAGE`, `FIXED_AMOUNT`, `FREE_SHIPPING`, `BUY_X_GET_Y`). Any string value can be stored as `type`.
**Fix:**
```typescript
const VALID_TYPES = ['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING', 'BUY_X_GET_Y']
if (!VALID_TYPES.includes(String(body.type))) {
  return errorResponse(`Invalid coupon type. Must be one of: ${VALID_TYPES.join(', ')}`, 400, origin)
}
```
**Severity: Medium**

---

#### M-10 - BUY_X_GET_Y Coupon Type Not Implemented
**File:** `backend/src/functions/coupons.ts` - `validateCoupon` switch statement
**Description:** The `CouponType` enum includes `BUY_X_GET_Y` but there is no `case 'BUY_X_GET_Y':` in the discount calculation switch. It falls through to `default: discount = 0`. This means a `BUY_X_GET_Y` coupon appears valid but silently gives zero discount.
**Fix:** Either implement the BUY_X_GET_Y logic or explicitly reject it as "not yet supported" until implementation is ready:
```typescript
case 'BUY_X_GET_Y':
  return errorResponse('BUY_X_GET_Y coupons are not yet supported', 400, origin)
```
**Severity: Medium**

---

#### M-11 ❌ REMOVED - Custom Order Row Move Was a False Positive
**Classification:** ❌ False Positive - removed after reading actual implementation

> The original finding claimed `adminUpdateCustomOrder` "does not move the row" on status change. Reading the actual code shows it **does** move the row: when `body.status !== existing.status`, the handler creates a new row with `rowKey: \`${newStatus}_${inquiryId}\`` and deletes the old row. The `listCustomOrders` filter by `r.status` field also works correctly. The implementation has a cosmetic code smell (inline `require()` - covered by M-15) but is functionally correct.

**No action needed.**

---

---

#### M-12 - Silent Error Swallowing in Notification Enqueue Calls
**File:** `backend/src/functions/customOrders.ts` - `submitCustomOrder`
**Classification:** ✅ Verified Bug (scope corrected from original)
**Description:** In `customOrders.ts`, after creating a custom order, the admin notification enqueue is wrapped in a bare `try { } catch { // Non-fatal }` that discards the error completely. If the queue is unavailable, no log entry is written; the failure is undetectable.

> **Correction vs. original finding:** The original finding said this pattern also applies to `orderAdmin.ts`. That is **incorrect**. In `adminUpdateStatus`, the notification enqueue is inside the outer function `try/catch`, so a queue failure returns a 500 to the caller - it does not go undetected (though it does incorrectly fail a status update that already succeeded).

**Two distinct issues in `orderAdmin.ts`:**
1. Enqueue failure inside the outer try/catch → returns 500, making the API appear to fail even though the status was successfully updated. The 500 message should be distinguished from a true failure.
2. No issue with silent swallowing - errors ARE surfaced (as 500s).

**Fix for `customOrders.ts`:**
```typescript
} catch (notifyErr) {
  context.warn('Failed to enqueue admin notification for custom order', notifyErr)
}
```
**Fix for `orderAdmin.ts`:** Wrap the notification step in its own try/catch so a queue outage doesn't fail a successful status update:
```typescript
try {
  for (const channel of notifications.customer) {
    await enqueueNotification({ ... })
  }
} catch (notifyErr) {
  context.warn('Failed to enqueue customer notification', notifyErr)
}
```
**Severity: Medium**

---

#### M-13 - No Pagination on Admin Review and Custom Order Endpoints
**File:** `backend/src/functions/reviews.ts` - `adminReviews`; `customOrders.ts` - `adminListCustomOrders`
**Description:** These endpoints return all records with no pagination. Combined with `listAll()` fetching the entire table, these endpoints will degrade as data grows.
**Fix:** Add `page` and `size` query parameters and implement the same `listPaginated` pattern used in order endpoints.
**Severity: Medium**

---

#### M-14 - Product Category Parsing is Fragile
**File:** `backend/src/services/tableStorage.ts` - `getProductById()`; `backend/src/functions/productAdmin.ts`
**Description:**
```typescript
const category = productId.split('-')[0]
```
This assumes all product IDs follow the `<category>-<uuid>` format. If any product ID doesn't have a dash, `split('-')[0]` returns the entire ID as the category, causing a silent lookup failure.
**Fix:** Validate that the product ID contains a dash before splitting, or store category separately (e.g., as a query parameter in the URL or in a separate table index).
**Severity: Medium**

---

#### M-15 - Inline `require()` Inside Function Bodies
**Files:** `backend/src/functions/upload.ts` - `customerUpload`; `backend/src/functions/customOrders.ts` - `adminUpdateCustomOrder`
**Classification:** ✅ Verified Code Quality Issue
**Description:** Two function handlers use CommonJS `require()` inside the function body instead of top-level ESM imports:
- `customerUpload`: `require('@azure/storage-blob')`, `require('@azure/identity')`, `require('uuid')` - called on every request, creating new client instances each time.
- `adminUpdateCustomOrder`: `require('@azure/data-tables')`, `require('@azure/identity')` - used for the inline delete-old-row logic.

This bypasses module-level caching (every invocation creates new SDK clients), prevents tree-shaking, and hides type errors.
**Fix:** Move all `require()` to top-level `import` statements. For `customerUpload`, extract the blob upload logic to `blobStorage.ts` as a `uploadUserImage()` function (reusing the existing singleton `blobServiceClient`). For `adminUpdateCustomOrder`, use the existing `getTableClient()` helper from `tableStorage.ts` directly.
**Severity: Medium**

---

#### M-16 - `staleTime` Set to Only 60 Seconds for Product Catalog
**File:** `frontend/components/Providers.tsx`
**Description:** The React Query `staleTime` of 60 seconds is applied globally. For product catalog data that changes infrequently, this causes unnecessary refetches. For order status data that must be fresh, 60 seconds may be too long to wait before showing updated status.
**Fix:** Override `staleTime` per-query:
- Product catalog: `staleTime: 5 * 60 * 1000` (5 min)
- Order status: `staleTime: 0` (always fresh)
- Announcements: `staleTime: 60 * 1000` (already cached at CDN level)
**Severity: Medium**

---

#### M-17 - No `Cache-Control: no-store` on Sensitive Admin Responses
**File:** `backend/src/utils/response.ts`
**Description:** Admin endpoints (`/api/admin/orders`, `/api/admin/reviews`, etc.) return sensitive data without `Cache-Control: no-store`. If any reverse proxy, CDN, or shared cache is introduced, these responses could be cached and served to other users.
**Fix:** Add `Cache-Control: no-store, no-cache` to all admin endpoint responses via the `jsonResponse` helper when the route is an admin route.
**Severity: Medium**

---

#### M-18 - Wishlist Enrichment Makes N+1 Database Calls
**File:** `backend/src/functions/wishlist.ts` - `wishlistHandler` (GET)
**Description:**
```typescript
const enriched = await Promise.all(
  items.map(async (item) => {
    const product = await getProductById(item.rowKey)
    // ...
  })
)
```
For a wishlist with 20 items, this makes 20 sequential (or parallel but still separate) Table Storage requests, each being an independent HTTP call to Azure.
**Why Problematic:** Latency multiplies with wishlist size. 20 items = 20 round-trips to Azure Table Storage.
**Fix:** Batch product lookups by category partition (group wishlist items by category, then query each partition once). Or cache product data client-side and skip server-side enrichment.
**Severity: Medium**

---

### LOW

---

#### L-01 - Cart Stores Stale Prices from API Without Staleness Warning
**File:** `frontend/stores/cart.ts`
**Description:** Product prices are stored in localStorage cart items. If a product's price changes after a user adds it to the cart, the displayed cart total is wrong until the cart is cleared. The backend re-validates prices at order creation (correct), but the frontend shows the wrong price at checkout.
**Fix:** On cart open or checkout page load, re-fetch current prices for all cart items and compare with stored prices. Show a warning if any price has changed.
**Severity: Low**

---

---

#### L-03 - No Test Files Anywhere in the Codebase
**Description:** Neither `backend/` nor `frontend/` contains any test files (`*.test.ts`, `*.spec.ts`, `__tests__/`). No test runner is configured in `package.json`.
**What's Missing:**
- Unit tests for `orderState.ts` (pure functions - easy to test)
- Unit tests for `csrf.ts` (signature verification)
- Unit tests for `rateLimit.ts`
- Integration tests for auth flows
- E2E tests for the checkout path (once implemented)
**Fix:** Add Jest (or Vitest) to both packages and start with unit tests for all pure services.
**Severity: Low** (but blocks confident production deployment)

---

#### L-04 - Weak Typing: `Row = Record<string, any>` Used Everywhere
**File:** `backend/src/services/tableStorage.ts`
**Description:** All table storage functions accept and return `Row = Record<string, any>`. The actual entity interfaces (`ProductEntity`, `OrderEntity`, etc.) exist in `types/index.ts` but are not used in `tableStorage.ts`.
**Fix:** Use the typed entity interfaces as generic parameters in table storage functions to catch type mismatches at compile time.
**Severity: Low**

---

#### L-05 - Dead Code: `isInWishlist` Function Never Used
**File:** `backend/src/services/tableStorage.ts` - `isInWishlist()`
**Description:** The function is defined but never imported or called anywhere in the codebase.
**Fix:** Remove the dead function.
**Severity: Low**

---

#### L-06 - `GOOGLE_CLIENT_ID` Not in `local.settings.example.json`
**File:** `backend/local.settings.example.json`
**Description:** The example settings file does not include `GOOGLE_CLIENT_ID`, which means developers setting up locally won't know they need to add it. Google login will silently fail with a confusing error.
**Fix:** Add `"GOOGLE_CLIENT_ID": "YOUR_GOOGLE_CLIENT_ID_HERE"` to the example file.
**Severity: Low**

---

#### L-07 - Admin orders page search/filter is non-functional (static HTML)
**File:** `frontend/app/admin/orders/page.tsx`
**Description:** The search input and status filter select are rendered as plain HTML with no state or event handlers. They are purely decorative and do nothing.
**Fix:** Convert to a client component, add state for filters, and wire up to `GET /api/admin/orders?status=...&q=...`.
**Severity: Low**

---

## Implementation Plan

Issues are ordered by priority. Fix in sequence to unblock production release.

---

### Phase 0 - Before Any Deploy (Blockers)

| # | Issue | File(s) | Effort |
|---|-------|---------|--------|
| 1 | **C-02** - Wire `csrfCheck` into all mutating handlers; remove hardcoded key fallback | `middleware/csrfGuard.ts`, `services/csrf.ts`, all function files | 2 hr |
| 2 | **H-03b** - JWT secret missing guard (crash risk) | `services/auth.ts` | 5 min |
| 3 | **H-11** - Google Client ID missing guard | `functions/userAuth.ts` | 5 min |
| 4 | **C-01** - Add rate limiting to login/register/googleAuth | `functions/userAuth.ts` | 1 hr |
| 5 | **C-05** - Replace Math.random() in order ID | `functions/orders.ts` | 15 min |
| 6 | **H-01** - Remove admin token from localStorage | `stores/adminAuth.ts`, `services/auth.ts` | 1 hr |
| 7 | **H-08** - Admin logout calls backend | `stores/adminAuth.ts` | 15 min |

---

### Phase 1 - Core Business Logic Fixes

| # | Issue | File(s) | Effort |
|---|-------|---------|--------|
| 8 | **C-06** - Implement stock decrement on order (ETag atomic write) | `functions/orders.ts`, `services/tableStorage.ts` | 2 hr |
| 9 | **C-04** - Apply coupon discount in createNewOrder | `functions/orders.ts`, `functions/coupons.ts` | 3 hr |
| 10 | **H-03** - Validate item quantity (1–100) | `functions/orders.ts` | 30 min |
| 11 | **H-06** - Prevent duplicate reviews | `functions/reviews.ts`, `services/tableStorage.ts` | 1 hr |
| 12 | **H-07** - Review username from users table | `functions/reviews.ts` | 30 min |
| 13 | **H-09** - Add max-length + format validation everywhere | `functions/addresses.ts`, `userAuth.ts`, `customOrders.ts`, `reviews.ts` | 1.5 hr |

---

### Phase 2 - Security Hardening

| # | Issue | File(s) | Effort |
|---|-------|---------|--------|
| 14 | **H-04** - File upload magic bytes + sharp validation | `functions/upload.ts` | 2 hr |
| 15 | **M-05** - Add X-Frame-Options, CSP headers | `staticwebapp.config.json` | 30 min |
| 16 | **L-07c** - Admin guard re-validates session via /auth/me (UX, not security) | `app/admin/layout.tsx` | 1 hr |
| 17 | **M-09** - Validate coupon type on creation | `functions/coupons.ts` | 15 min |
| 18 | **M-10** - Handle BUY_X_GET_Y (implement or reject) | `functions/coupons.ts` | 2 hr |
| 19 | **M-17** - Add no-store to admin responses | `utils/response.ts` | 30 min |

---

### Phase 3 - Reliability & Scalability

| # | Issue | File(s) | Effort |
|---|-------|---------|--------|
| 20 | **H-05** - Fix `listAll()` unbounded fetches; add maxRows + pagination | `services/tableStorage.ts`, admin endpoints | 3 hr |
| 21 | **H-10** - Build nightly secondary-index reconciliation timer | `functions/` (new file) | 4 hr |
| 22 | **M-04** - Fix event rowKey collision | `functions/orders.ts`, `orderAdmin.ts` | 30 min |
| 23 | **L-07b** - Delete `updateOrderStatus` dead code | `services/tableStorage.ts` | 15 min |
| 24 | **M-08** - Document rate limiter ±1 approximation (acceptable at current scale) | `services/rateLimit.ts` | 15 min |
| 25 | **M-12** - Log swallowed notification errors; wrap orderAdmin enqueue in inner try | `functions/customOrders.ts`, `orderAdmin.ts` | 15 min |
| 26 | **M-18** - Fix N+1 wishlist enrichment | `functions/wishlist.ts` | 1 hr |
| 27 | **M-07** - Re-enable Request telemetry in Application Insights | `host.json` | 5 min |

---

### Phase 4 - Frontend Completeness

| # | Issue | File(s) | Effort |
|---|-------|---------|--------|
| 28 | **G-02** - Implement customer login page | `app/login/page.tsx` | 1 day |
| 29 | **G-02** - Implement checkout page (Phase 2 milestone) | `app/checkout/page.tsx` | 3 days |
| 30 | **G-01** - Wire admin dashboard to real API data | `app/admin/page.tsx` | 1 day |
| 31 | **L-07** - Wire admin orders search/filter to API | `app/admin/orders/page.tsx` | 1 day |

---

### Phase 5 - Code Quality

| # | Issue | File(s) | Effort |
|---|-------|---------|--------|
| 32 | **M-13** - Add pagination to reviews and custom orders | `functions/reviews.ts`, `customOrders.ts` | 1 hr |
| 33 | **M-14** - Validate product ID format before split | `services/tableStorage.ts` | 30 min |
| 34 | **M-15** - Move `require()` to top-level imports | `functions/upload.ts`, `functions/customOrders.ts` | 30 min |
| 35 | **M-16** - Per-query staleTime config in React Query | `components/Providers.tsx` | 30 min |
| 36 | **L-01** - Stale cart price warning at checkout | `app/checkout/`, `stores/cart.ts` | 1 hr |
| 37 | **L-04** - Type `tableStorage.ts` with entity interfaces | `services/tableStorage.ts` | 2 hr |
| 38 | **L-05** - Remove `isInWishlist` dead code | `services/tableStorage.ts` | 5 min |
| 39 | **L-06** - Add GOOGLE_CLIENT_ID to example settings | `local.settings.example.json` | 5 min |
| 40 | ~~M-11~~ - ❌ Removed (false positive - custom order row move IS implemented) | - | - |

---

### Phase 6 - Testing

| # | Area | Test Type | Priority |
|---|------|-----------|----------|
| 42 | `services/orderState.ts` (all pure functions) | Unit | High |
| 43 | `services/csrf.ts` (generate + verify + timing) | Unit | High |
| 44 | `services/auth.ts` (token sign/verify, cookie builder) | Unit | High |
| 45 | `services/rateLimit.ts` (window expiry, concurrent calls) | Unit | Medium |
| 46 | Auth endpoints (register, login, Google, logout) | Integration | High |
| 47 | Order creation with stock check and coupon | Integration | High |
| 48 | Admin role guard (admin vs superadmin access) | Integration | High |
| 49 | Checkout flow (address → coupon → order) | E2E | Medium |

---

## Unfinished / Placeholder Areas

| Area | Status | Notes |
|------|--------|-------|
| Customer login/register UI | Placeholder | Backend fully implemented; frontend missing |
| Checkout / payment | Placeholder | Backend order creation exists; no Razorpay integration; no UI |
| Admin analytics page | Placeholder directory only | No implementation |
| Admin inventory page | Placeholder directory only | No implementation |
| Admin categories page | Placeholder directory only | No implementation |
| Admin collections page | Placeholder directory only | No implementation |
| Admin customers page | Placeholder directory only | No implementation |
| Admin settings page | Placeholder directory only | No implementation |
| Admin media page | Placeholder directory only | No implementation |
| Admin orders detail/action | Mock data only | Not connected to backend |
| Notification processing | Queue populated; no consumer | WhatsApp/email/push notifications enqueued but nothing reads the queue |
| Review request scheduling | Queue populated; no consumer | `enqueueReviewRequest` writes to queue; no timer function reads it |
| Webhook processing | Queue populated; no consumer | `enqueueWebhook` writes to queue; no processor reads it |
| Payment integration | Referenced in types/comments | Razorpay fields in `OrderEntity` but no payment endpoints exist |
| Invoice generation | Referenced in types/order | `invoiceUrl` field exists; no invoice generation service |
| Account/wishlist UI | Directory exists | `/account/wishlist/` directory exists but no page.tsx found |

---

## Missing Test Coverage

The entire codebase has **zero tests**. Before any production release:

1. **Unit tests** for all pure business logic in `services/` (especially `orderState.ts`, `csrf.ts`, `auth.ts`, `rateLimit.ts`)
2. **Integration tests** for all auth flows (register, login, Google, admin login, token refresh, logout)
3. **Integration tests** for the order lifecycle (create → confirm → ship → deliver → return)
4. **Integration tests** for coupon validation edge cases (expired, over-limit, first-time-only, concurrent)
5. **E2E tests** for the customer checkout path once implemented
6. **Security regression tests** for all OWASP Top 10 vectors

---

*This document was generated by a full-codebase audit on 2026-05-14. Update the status column in the implementation plan as issues are resolved.*
