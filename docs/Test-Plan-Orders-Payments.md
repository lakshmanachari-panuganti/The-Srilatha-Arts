# Test plan - order placement, payments, returns &amp; refunds

A runbook-style test plan for the Srilatha Art order + payment +
return flow. Hand this to a QA person and they can execute it
end-to-end from a fresh browser.

> **Scope:** DEV environment only. PRD uses live keys and real
> money - never run these scenarios there.

| | |
| --- | --- |
| **Frontend** | `https://delightful-mushroom-062e18100.7.azurestaticapps.net/` |
| **Backend** | `https://func-thesrilathaarts-dev.azurewebsites.net` |
| **Razorpay mode** | Test (`rzp_test_…`) |
| **Test user** | any signed-in customer (we use `thesousi5891@gmail.com` below - substitute your own) |
| **Test admin** | any user in the `admins` table on DEV - see *Admin access* below |

---

## 0. Test data

### UPI test VPAs (Razorpay-provided)

| VPA | Outcome |
| --- | --- |
| `success@razorpay` | Payment succeeds and is captured |
| `failure@razorpay` | Payment fails |

### Card numbers (any future expiry MM/YY, any 3-digit CVV)

| Card | Outcome |
| --- | --- |
| `4111 1111 1111 1111` | Successful Visa |
| `5104 0600 0000 0008` | Successful Mastercard |
| `4012 0010 3714 1112` | Successful card requiring 3D-Secure auth - uses test OTP `123456` |
| `4000 0000 0000 0002` | Card declined |
| `4000 0000 0000 0069` | Card expired |
| `4000 0000 0000 0119` | Processing error |
| `4000 0000 0000 9979` | Insufficient funds |

### Test OTP

For any 3DS card, when Razorpay's bank-simulator OTP screen appears,
type **`123456`**.

---

## 1. Pre-flight checks (do these once before running any scenario)

### 1.1 Function App env vars

The DEV Function App must have these three settings. To check via Az PowerShell:

```powershell
. ./docs/Azure-Connectivity.ps1
Get-AzFunctionAppSetting -ResourceGroupName 'rg-thesrilathaarts-dev' -Name 'func-thesrilathaarts-dev' |
  Where-Object { $_.Key -like 'RAZORPAY_*' } |
  Sort-Object Key |
  ForEach-Object {
    if ($_.Key -eq 'RAZORPAY_KEY_ID') { "  $($_.Key) = $($_.Value)" }
    else                              { "  $($_.Key) = ******** ($($_.Value.Length) chars)" }
  }
```

Expect:
```
  RAZORPAY_KEY_ID         = rzp_test_…
  RAZORPAY_KEY_SECRET     = ******** (24 chars)
  RAZORPAY_WEBHOOK_SECRET = ******** (15–44 chars depending on rotation)
```

If `RAZORPAY_KEY_ID` starts with `rzp_live_` on DEV, **stop** - that's
the wrong key set for this environment. Run [`Rotate-RazorpayApiKeys.ps1`](../infra/Rotate-RazorpayApiKeys.ps1)
to restore test keys before testing.

### 1.2 Razorpay Dashboard webhook

In the Razorpay Dashboard, toggle to **Test mode** (top-right).
Navigate Settings → Webhooks. You should see one entry:

| URL | Status | Events |
| --- | --- | --- |
| `https://func-thesrilathaarts-dev.azurewebsites.net/api/razorpay/webhook` | Enabled | `payment.captured`, `payment.failed` (+ `refund.processed`, `refund.failed` if returns testing) |

The **webhook secret in the dashboard must match `RAZORPAY_WEBHOOK_SECRET`
on the Function App, byte-for-byte**. If they drift, every webhook
delivery comes back as `400 Bad signature` and orders stay stuck at
PAYMENT PENDING after sync verify drop-outs. To re-align, run
[`Rotate-RazorpayWebhookSecret.ps1`](../infra/Rotate-RazorpayWebhookSecret.ps1)
and paste the printed value into the dashboard.

### 1.3 Public endpoint smoke test

```powershell
Invoke-RestMethod -Uri 'https://func-thesrilathaarts-dev.azurewebsites.net/api/shipping-settings'
```

Expect a JSON shipping config back. If this 404s the backend isn't
deployed. If it 500s the storage account isn't reachable. Either way
- resolve before any other test.

### 1.4 Sign in as the test customer

Open the DEV frontend, sign in as your test customer (we'll call this
`{TEST_EMAIL}` below). Confirm the header avatar shows the first
initial - that means the auth state is loaded and the cart will be
auth-gated correctly.

### 1.5 Admin access

For Scenarios 11–14 you'll also need an admin session. Open the same
DEV frontend at `/admin/login` and sign in with an admin account from
the `admins` table.

> Tip: if you don't know any admin credentials, run the one-time
> `POST /api/auth/admin/setup` with the `ADMIN_SETUP_KEY` from the
> Function App settings to create the first admin. See
> `backend/src/functions/adminAuth.ts` for the contract.

---

## 2. Scenarios

Each scenario has:
- **Goal** - what's being tested
- **Steps** - exactly what to do at the keyboard
- **Expected** - what should happen in the UI, in the Razorpay
  Dashboard, and in the order database
- **Verify in DB** - a one-liner you (or whoever is babysitting the
  test run) can use to confirm the order's state

### Scenario 2.1 - Successful UPI

**Goal:** end-to-end happy path with the most common payment method.

**Steps:**
1. From the home page or `/shop`, add any in-stock product (cheapest is fine) to the cart.
2. Open `/cart`, click **Checkout**.
3. Fill the shipping form OR pick a saved address. Submit.
4. Razorpay Checkout opens. Pick **UPI**.
5. Enter VPA `success@razorpay`. Click Pay.
6. Razorpay simulates a successful capture. Checkout closes.
7. The site shows the success page with an order ref like `TSA-2026-XXXXXXXXXX`.

**Expected:**
- ✅ Success page is shown with the order id.
- ✅ Cart is now empty.
- ✅ `/account` Orders tab shows this order with status **Confirmed** and the right ₹ total.
- ✅ Razorpay Dashboard → Payments → today, shows `pay_…` with status `captured` and amount = order total.
- ✅ Razorpay Dashboard → Webhooks → Recent Deliveries shows a `payment.captured` event with HTTP 200.

**Verify in DB:**
```
status         = CONFIRMED
paymentStatus  = CAPTURED
razorpayPaymentId is set
razorpayOrderId is set
```

### Scenario 2.2 - Failed UPI

**Goal:** payment fails - order must stay un-confirmed and customer must see a clear failure message.

**Steps:**
1. Add a product, go to checkout, fill shipping.
2. In Razorpay Checkout, UPI tab, enter `failure@razorpay`. Click Pay.
3. Razorpay simulates a failed payment. Checkout shows a failure screen.
4. Cancel out / close the Razorpay modal.

**Expected:**
- ✅ The cart page (or whichever page the customer is left on) shows the friendly error: *"Payment failed. You can retry from the cart - no charge was made."*
- ✅ Cart is **not** cleared (so the customer can retry).
- ✅ `/account` Orders tab DOES show the order, with status **Order placed / Payment pending** (the order row is created server-side before Razorpay Checkout opens).
- ✅ Razorpay Dashboard → Payments shows the attempt with status `failed`.
- ✅ Razorpay Dashboard → Webhooks should fire `payment.failed` → our webhook returns 200.

**Verify in DB:**
```
status         = PLACED
paymentStatus  = FAILED  (after webhook lands)
                or PENDING (if webhook hasn't arrived yet)
```

### Scenario 2.3 - Successful Visa

**Goal:** card payment without 3DS.

**Steps:**
1. Add product, checkout, shipping.
2. Razorpay Checkout → Cards tab.
3. Card number: `4111 1111 1111 1111`
4. Expiry: any future date (e.g. `12/30`)
5. CVV: `123`
6. Name on card: anything.
7. Click Pay.

**Expected:**
- ✅ Success page, order in CONFIRMED state.
- ✅ Razorpay Dashboard shows Visa payment captured.

**Verify in DB:** same as Scenario 2.1.

### Scenario 2.4 - Successful Mastercard

**Goal:** prove non-Visa networks also work.

**Steps:** same as 2.3, but card number `5104 0600 0000 0008`.

**Expected:** same as Scenario 2.3.

### Scenario 2.5 - 3D-Secure card (OTP flow)

**Goal:** the additional bank authentication step doesn't break anything.

**Steps:**
1. Checkout as before.
2. Card: `4012 0010 3714 1112`, future expiry, any CVV.
3. After clicking Pay, Razorpay shows a "bank OTP" screen. Enter `123456`.
4. Submit.

**Expected:** same as Scenario 2.3, plus the OTP screen appeared and the OTP was accepted.

**Verify in DB:** same as Scenario 2.1.

### Scenario 2.6 - Card declined

**Goal:** issuer-declined transaction. No money should move; order should stay un-confirmed.

**Steps:**
1. Checkout, Cards tab.
2. Card: `4000 0000 0000 0002`, future expiry, any CVV.

**Expected:**
- ✅ Razorpay Checkout shows an inline "Card declined" message.
- ✅ User can change method or retry without re-entering the form (Razorpay re-opens within the modal).
- ✅ If the user dismisses the modal: same end-state as Scenario 2.2 - friendly error on site, cart preserved.
- ✅ Razorpay Dashboard → Payments shows the attempt with status `failed` and `error_reason` populated (e.g. `BAD_REQUEST_ERROR`).

**Verify in DB:**
```
status         = PLACED
paymentStatus  = FAILED  (after webhook lands)
```

### Scenario 2.7 - Card expired

**Steps:** same as 2.6 but card `4000 0000 0000 0069`.

**Expected:** same as 2.6 but error reason is `expired_card`.

### Scenario 2.8 - Processing error

**Steps:** same as 2.6 but card `4000 0000 0000 0119`.

**Expected:** same as 2.6 but error reason is `processing_error`.

### Scenario 2.9 - Insufficient funds

**Steps:** same as 2.6 but card `4000 0000 0000 9979`.

**Expected:** same as 2.6 but error reason is `insufficient_funds`.

### Scenario 2.10 - Abandoned cart / sync verify drop-out

**Goal:** prove the webhook is the safety net. Forcing the sync verify to not fire is the classic source of the "stuck PENDING" bug.

**Steps:**
1. Checkout, Razorpay opens.
2. Pay with `success@razorpay` (UPI) OR `4111 1111 1111 1111`.
3. **The instant** Razorpay says "Payment successful", *close the browser tab* before the success page can render.
4. Wait ~15 seconds.

**Expected:**
- ✅ Razorpay Dashboard shows the payment captured.
- ✅ Razorpay Webhooks → Recent Deliveries fires `payment.captured` → 200.
- ✅ Even though the browser-side `/api/razorpay/verify` never ran, the **webhook handler reconciled the order**. `/account` shows status **Confirmed**.

**Verify in DB (after waiting):**
```
status         = CONFIRMED
paymentStatus  = CAPTURED
```

If the order is stuck at PAYMENT PENDING after 30 seconds, the webhook isn't reaching us. Most common causes:
- Webhook URL in Razorpay Dashboard doesn't match the Function App URL.
- `RAZORPAY_WEBHOOK_SECRET` on the Function App doesn't match what's in the dashboard.
- Function App is cold-starting and the webhook timed out - Razorpay retries up to 24 hours, so wait and re-check.

---

## 3. Return + refund scenarios

These require a previously-delivered order. The fastest way to set one
up: complete Scenario 2.1, then in the **admin portal** move that order
through CONFIRMED → CRAFTING → PACKED → SHIPPED → DELIVERED. Now the
customer is eligible to request a return.

### Scenario 3.1 - Customer requests a return

**Goal:** structured-reason return request flow.

**Steps as customer:**
1. Sign in as the customer who placed the order.
2. `/account` → Orders → find the DELIVERED order.
3. Click **"Request a return"** (visible only within 7 days of delivery).
4. Pick a reason (e.g. *Item arrived damaged*).
5. Optionally add a comment.
6. Submit.

**Expected:**
- ✅ Modal closes; the order card now shows an amber "Return request submitted" banner with the chosen reason.
- ✅ Status pill on the order card becomes **Return requested**.

**Verify in DB:**
```
status              = RETURN_REQUESTED
returnRequestedAt   is set (recent ISO timestamp)
returnReason        = <chosen code>
returnComment       = <text>
```

**Edge cases worth a manual run:**
- Submit a request with reason `other` and **no comment** → form should reject with "Please tell us a bit about the issue when choosing Other".
- Submit a request for an order delivered &gt; 7 days ago (manually back-date the delivered event in DB to test) → backend returns 400 with the 7-day-window message.

### Scenario 3.2 - Admin approves the return + issues the refund

**Steps as admin:**
1. Sign in to `/admin/login`.
2. Orders → find the order in RETURN_REQUESTED.
3. Click the order id → opens `/admin/orders/detail?id=…`.
4. The pink **"Return requested"** banner at the top shows the customer's reason + comment.
5. Click **Approve return**.

**Expected after Approve:**
- ✅ Order status → **RETURNED**.
- ✅ Banner changes to the rose **"Return received"** card with an **Issue refund** button.

**Continue:**
6. Click **Issue refund**.
7. Confirm the amount in the modal (defaults to the full order total - change to a partial if you want to test partial refunds).
8. Confirm.

**Expected after Issue refund:**
- ✅ The backend calls Razorpay's refund API. If accepted: order moves to **REFUNDED** and an emerald summary card shows the refund amount + date + Razorpay refund id.
- ✅ Razorpay Dashboard → Payments → click the original payment → Refunds tab shows a new refund row.
- ✅ Razorpay Webhooks → Recent Deliveries fires `refund.processed` within ~minutes (test-mode is usually instant). The order's `refundFailureReason` clears and the `razorpayRefundId` is double-confirmed.

**Verify in DB:**
```
status              = REFUNDED
paymentStatus       = REFUNDED
refundAmount        = <paise>
refundedAt          is set
razorpayRefundId    = rfnd_…
refundFailureReason is empty
```

### Scenario 3.3 - Admin declines the return

**Goal:** the back-out path.

**Pre-step:** create a fresh return request via Scenario 3.1.

**Steps as admin:**
1. Open the order detail page.
2. Click **Decline return**.
3. Modal asks for a reason (e.g. *"Outside the 7-day return window"*). Type it. Submit.

**Expected:**
- ✅ Order status → **DELIVERED** (the state machine specifically allows this).
- ✅ Order card on customer's `/account` shows a red **"Return request was declined"** banner with the reason.
- ✅ Customer is not eligible to request another return (the 7-day window may still be open, but the request is recorded against the order).

**Verify in DB:**
```
status              = DELIVERED
returnDeclineReason = "<reason text>"
```

### Scenario 3.4 - Razorpay rejects the refund

**Goal:** unhappy path on the gateway side. Useful for confirming we
don't leave the order in an inconsistent state if Razorpay says no.

This one's hard to trigger deliberately in test mode - Razorpay test
mode almost always accepts refunds. The cleanest way to simulate it:
**use Postman / curl to call our admin endpoint with an invalid
`razorpayPaymentId`** so Razorpay's API rejects.

Alternatively, just verify the error-handling code path by reading
[backend/src/functions/orderAdmin.ts](../backend/src/functions/orderAdmin.ts) -
on `createRefund` failure the order **stays at RETURNED** and the
gateway's error is surfaced to the admin via a 502 response.

**Verify in DB after a deliberate failure:**
```
status              = RETURNED  (not REFUNDED - we held)
refundFailureReason = "<Razorpay error>"
razorpayRefundId    is NOT set
```

---

## 4. Negative / webhook-plumbing tests

### Scenario 4.1 - Unsigned webhook is rejected

**Goal:** verify the signature check is engaged.

```powershell
Invoke-WebRequest `
  -Uri 'https://func-thesrilathaarts-dev.azurewebsites.net/api/razorpay/webhook' `
  -Method POST `
  -Body '{"event":"test"}' `
  -ContentType 'application/json' `
  -SkipHttpErrorCheck
```

**Expected:** HTTP 400, body `"Bad signature"`.

### Scenario 4.2 - Webhook with a wrong secret is rejected

```powershell
$body = '{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_test","order_id":"order_test"}}}}'
$wrongHmac = (-join (
  [System.Security.Cryptography.HMACSHA256]::new([System.Text.Encoding]::UTF8.GetBytes('definitely-wrong-secret')).ComputeHash([System.Text.Encoding]::UTF8.GetBytes($body)) |
  ForEach-Object { $_.ToString('x2') }
))
Invoke-WebRequest `
  -Uri 'https://func-thesrilathaarts-dev.azurewebsites.net/api/razorpay/webhook' `
  -Method POST `
  -Body $body `
  -ContentType 'application/json' `
  -Headers @{ 'X-Razorpay-Signature' = $wrongHmac } `
  -SkipHttpErrorCheck
```

**Expected:** HTTP 400, body `"Bad signature"`.

### Scenario 4.3 - Sync verify with a forged signature is rejected

**Goal:** confirm `/api/razorpay/verify` won't accept a hand-crafted signature.

```powershell
# This requires a valid CSRF token + auth cookie since /verify is CSRF-gated.
# Easiest path: drive it from the browser console while logged in.
fetch('/api/razorpay/verify', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': document.cookie.split('tsa_csrf=')[1]?.split(';')[0] },
  body: JSON.stringify({
    razorpayOrderId:   'order_FORGED',
    razorpayPaymentId: 'pay_FORGED',
    razorpaySignature: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    internalOrderId:   'TSA-2026-FAKE',
  }),
}).then((r) => r.status)
```

**Expected:** HTTP 400 from the backend with body `{ "error": "Payment signature verification failed" }`.

---

## 5. Cross-cutting verification

### 5.1 How to read an order's state from Azure Tables

```powershell
. ./docs/Azure-Connectivity.ps1
Import-Module Az.Storage

$ctx = New-AzStorageContext -StorageAccountName 'stthesrilathaartsdev' -UseConnectedAccount
$table = (Get-AzStorageTable -Name 'orders' -Context $ctx).CloudTable

# Replace with the customer's email (the partition key) and the order id (row key).
$pk = 'thesousi5891@gmail.com'
$rk = 'TSA-2026-XXXXXXXXXX'

$op = [Microsoft.Azure.Cosmos.Table.TableOperation]::Retrieve($pk, $rk)
$result = $table.Execute($op)
$result.Result.Properties.GetEnumerator() | Sort-Object Key | ForEach-Object {
    "{0,-25} = {1}" -f $_.Key, $_.Value.PropertyAsObject
}
```

Look for:

| Property | What it should be |
| --- | --- |
| `status` | `PLACED` / `CONFIRMED` / … / `REFUNDED` |
| `paymentStatus` | `PENDING` / `CAPTURED` / `FAILED` / `REFUNDED` |
| `razorpayOrderId` | always set after `/create-order` |
| `razorpayPaymentId` | set after capture |
| `razorpayRefundId` | set after refund |
| `returnReason`, `returnComment`, `returnRequestedAt` | for return requests |
| `refundAmount`, `refundedAt`, `refundFailureReason` | for refunds |

### 5.2 Razorpay Dashboard

For each scenario, the matching Razorpay Dashboard view is:
- **Payments → Today** - the captured / failed payments
- **Webhooks → Recent Deliveries** - every webhook attempt with response code + retry count
- **Payments → click a payment → Refunds tab** - refunds against that payment

### 5.3 Function App logs (App Insights)

For deeper investigation when something doesn't behave:

1. Azure Portal → `func-thesrilathaarts-dev` → **Log stream** for real-time output
2. Or **Application Insights → Logs**, query:

```kusto
traces
| where timestamp > ago(30m)
| where message contains "razorpay" or message contains "webhook"
| order by timestamp desc
```

Pay attention to:
- `razorpayWebhook: signature mismatch` - secret drift
- `razorpayWebhook: no internal order matched` - webhook fired but our DB has no order with that `razorpayOrderId` (this is what happens when the dev frontend talks to prd webhook URL or vice versa)
- `verifyPayment: signature mismatch` - sync verify was tampered with

---

## 6. Test artefact tracking

Suggested template for capturing each test run (paste into a spreadsheet
or a Linear/Jira ticket):

| Scenario | Date | Tester | Order ID | Razorpay payment id | Final order status | Webhook landed? | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2.1 Successful UPI | 2026-mm-dd | … | TSA-2026-… | pay_… | CONFIRMED | Y | clean |
| 2.2 Failed UPI | … | … | TSA-2026-… | (none) | PLACED/FAILED | Y | error msg shown |
| … | | | | | | | |

After all rows go green, the integration is production-ready.

---

## 7. Cleaning up

Test orders pile up. Two safe cleanup options:

1. **Soft (recommended)** - leave the orders in DEV indefinitely.
   Storage is cheap, and the data is useful for diagnosing future
   regressions.

2. **Hard** - only if you really need a clean slate. Delete the rows
   by partition key from `stthesrilathaartsdev` `orders` /
   `orderItems` / `orderEvents` / `ordersByStatus`. Do **not** touch
   the corresponding payments in the Razorpay Dashboard - Razorpay
   keeps a forever audit trail and that's fine.

Never run this cleanup against PRD storage.

---

## 8. Known limitations / gotchas

- **Razorpay Checkout is iframed from `checkout.razorpay.com`.** Browser
  automation tools (Playwright, Selenium) can drive everything up to the
  "Open Razorpay" click but can't enter card/UPI inside the iframe.
  Manual testing is mandatory.

- **Sync verify can drop** if the user closes the browser tab the
  instant payment succeeds (Scenario 2.10). The webhook is the safety
  net. If you ever see an order stuck at PAYMENT PENDING for more than
  30 seconds after a captured payment, the webhook chain is broken -
  do the troubleshooting in §5.3.

- **The webhook secret must be identical on both sides.** Rotating it
  in one place without updating the other will silently break
  reconciliation for every payment after the rotation. Use
  `infra/Rotate-RazorpayWebhookSecret.ps1` to rotate the Function App
  side, then paste the printed value into the Razorpay Dashboard.

- **Test cards / VPAs only behave like the table says in test mode.**
  Using them against live keys (`rzp_live_…`) will get the merchant
  account flagged for fraud monitoring. Always confirm `RAZORPAY_KEY_ID`
  starts with `rzp_test_` on DEV before starting a test run.
