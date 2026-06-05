# WhatsApp template definitions

Copy-paste-ready spec for every WhatsApp template the app expects. Each
section maps directly to the fields you'll fill at:

  **Meta for Developers → your App → WhatsApp → Message Templates →
  Create template**

## Status legend

| Marker | Meaning |
|---|---|
| ✅ **LIVE** | Approved in WhatsApp Manager AND a queue handler in [functions/notificationsQueue.ts](../../backend/src/functions/notificationsQueue.ts) actually sends it today. |
| 🟡 **READY** (template only) | Code already enqueues this template key (see "Where it's enqueued" per section). Once you create + approve it in WhatsApp Manager AND add a queue-consumer case, sends will fire. Until then the queue trigger logs `[notify] no handler for ...` and drops the message. |

## Common rules (all templates)

| Field | Value |
|---|---|
| Category | **Utility** (NOT Marketing — these are transactional. Utility gives better delivery quality + lower per-message cost.) |
| Language | **English (`en`)** — must match the `WHATSAPP_TEMPLATE_LANGUAGE` Function App setting. |
| Footer | Leave blank unless noted per template. |
| Buttons | None unless noted per template. |
| Variables | All variables are `{{1}}`, `{{2}}`, ... in body order. Meta requires sequential numbering. |

## Editing rule

If you edit any of the bodies below in WhatsApp Manager, copy the change
back into this file in the same commit so we don't drift.

---

# 1. `order_confirmation_new_artwork` ✅ LIVE

**Purpose:** customer order confirmation sent right after Razorpay
captures the payment. Attaches the invoice PDF.

### Meta form

**Name**
```
order_confirmation_new_artwork
```

**Header — Type**
```
Media → Document
```
(No header text. Upload any placeholder PDF as Meta's sample — the real PDF link is supplied at runtime.)

**Body**
```
Dear {{1}},

Thank you for placing your order with Srilatha Art.

Your order# {{2}} has been successfully confirmed.

📄 Your invoice is attached for reference.

Each piece we create is handcrafted with passion, ensuring a unique artistic experience for every customer.

We appreciate your trust and support ❤️

Sincerely,
Srilatha Art
```

**Body — sample variable values**
```
{{1}} = Sunita Devi
{{2}} = 20260604153045
```

### Variables sent at runtime

| Position | Source | Example |
|---|---|---|
| `{{1}}` | `order.customerName` | `Sunita Devi` |
| `{{2}}` | `order.rowKey` (Order/Invoice ID) | `20260604153045` |

### Header document at runtime

```
URL:      https://www.srilatha.art/invoices/{InvoiceNumber}.pdf
Filename: invoice-{InvoiceNumber}.pdf
```

### Where it's enqueued

- [services/orderFulfillment.ts](../../backend/src/services/orderFulfillment.ts) — after `payment.captured`
- [functions/orderAdminNotifications.ts](../../backend/src/functions/orderAdminNotifications.ts) — admin Resend WhatsApp

---

# 2. `order_crafting` 🟡 READY

**Purpose:** the studio has begun crafting the piece. Sent when an admin
marks the order `CRAFTING`.

### Meta form

**Name**
```
order_crafting
```

**Header — Type**
```
None
```

**Body**
```
Dear {{1}},

We've started crafting your order {{2}} ✨

Each piece is handmade with care in our Hyderabad studio. We'll keep you posted as it takes shape.

Thank you for your patience.

Sincerely,
Srilatha Art
```

**Body — sample variable values**
```
{{1}} = Sunita Devi
{{2}} = 20260604153045
```

### Variables sent at runtime

| Position | Source | Example |
|---|---|---|
| `{{1}}` | `order.customerName` | `Sunita Devi` |
| `{{2}}` | `order.rowKey` | `20260604153045` |

### Where it's enqueued

- [functions/orderAdmin.ts](../../backend/src/functions/orderAdmin.ts) `adminUpdateStatus` — when admin transitions to `CRAFTING`
- templateKey produced as `order_${to.toLowerCase()}` → `order_crafting`

---

# 3. `order_shipped` 🟡 READY

**Purpose:** order shipped with the courier. Includes tracking
information so the customer can follow the package.

### Meta form

**Name**
```
order_shipped
```

**Header — Type**
```
None
```

**Body**
```
Dear {{1}},

Your order {{2}} is on its way! 📦

Shipped via {{3}}
Tracking number: {{4}}

You'll receive your handcrafted piece soon. If you have any questions, just reply to this message.

Sincerely,
Srilatha Art
```

**Body — sample variable values**
```
{{1}} = Sunita Devi
{{2}} = 20260604153045
{{3}} = DTDC
{{4}} = DTDC-9912-AB
```

### Variables sent at runtime

| Position | Source | Example |
|---|---|---|
| `{{1}}` | `order.customerName` | `Sunita Devi` |
| `{{2}}` | `order.rowKey` | `20260604153045` |
| `{{3}}` | `body.courier` (admin input on status patch) | `DTDC` |
| `{{4}}` | `body.tracking` (admin input on status patch) | `DTDC-9912-AB` |

### Where it's enqueued

- [functions/orderAdmin.ts](../../backend/src/functions/orderAdmin.ts) `adminUpdateStatus` — when admin transitions to `SHIPPED`

---

# 4. `order_cancelled` 🟡 READY

**Purpose:** confirm a cancellation. Triggered when an admin (or the
customer-side cancel route) flips the order to `CANCELLED`.

### Meta form

**Name**
```
order_cancelled
```

**Header — Type**
```
None
```

**Body**
```
Dear {{1}},

Your order {{2}} has been cancelled.

Reason: {{3}}

If you'd paid online, your refund will be processed shortly. We're sorry for any inconvenience.

If you have any questions, reply to this message or write to studio@srilatha.art.

Sincerely,
Srilatha Art
```

**Body — sample variable values**
```
{{1}} = Sunita Devi
{{2}} = 20260604153045
{{3}} = Customer changed their mind
```

### Variables sent at runtime

| Position | Source | Example |
|---|---|---|
| `{{1}}` | `order.customerName` | `Sunita Devi` |
| `{{2}}` | `order.rowKey` | `20260604153045` |
| `{{3}}` | `body.cancelReason` (admin input on status patch) | `Customer changed their mind` |

### Where it's enqueued

- [functions/orderAdmin.ts](../../backend/src/functions/orderAdmin.ts) `adminUpdateStatus` — when admin transitions to `CANCELLED`

---

# 5. `order_on_hold` 🟡 READY

**Purpose:** keep the customer informed when an order is paused (stock
issue, address verification needed, payment review, etc.).

### Meta form

**Name**
```
order_on_hold
```

**Header — Type**
```
None
```

**Body**
```
Dear {{1}},

A quick note about your order {{2}} — we've put it on hold while we sort something out.

{{3}}

We'll be in touch as soon as we can move forward. Thank you for your patience.

Sincerely,
Srilatha Art
```

**Body — sample variable values**
```
{{1}} = Sunita Devi
{{2}} = 20260604153045
{{3}} = We're verifying your shipping address before we dispatch.
```

### Variables sent at runtime

| Position | Source | Example |
|---|---|---|
| `{{1}}` | `order.customerName` | `Sunita Devi` |
| `{{2}}` | `order.rowKey` | `20260604153045` |
| `{{3}}` | `body.holdReason` (admin input on status patch) | `We're verifying your shipping address before we dispatch.` |

### Where it's enqueued

- [functions/orderAdmin.ts](../../backend/src/functions/orderAdmin.ts) `adminUpdateStatus` — when admin transitions to `ON_HOLD`

---

# 6. `order_refunded` 🟡 READY

**Purpose:** confirm a refund has gone out via Razorpay.

### Meta form

**Name**
```
order_refunded
```

**Header — Type**
```
None
```

**Body**
```
Dear {{1}},

Your refund for order {{2}} has been processed ✓

Amount: ₹{{3}}

It typically reflects in your account within 5-7 business days, depending on your bank.

Sincerely,
Srilatha Art
```

**Body — sample variable values**
```
{{1}} = Sunita Devi
{{2}} = 20260604153045
{{3}} = 4,349
```

### Variables sent at runtime

| Position | Source | Example |
|---|---|---|
| `{{1}}` | `order.customerName` | `Sunita Devi` |
| `{{2}}` | `order.rowKey` | `20260604153045` |
| `{{3}}` | `body.refundAmount / 100`, formatted `en-IN` | `4,349` |

### Where it's enqueued

- [functions/orderAdmin.ts](../../backend/src/functions/orderAdmin.ts) `adminUpdateStatus` — when admin transitions to `REFUNDED`

---

# 7. `return_declined` 🟡 READY

**Purpose:** notify the customer that their return request was reviewed
and declined, with the reason.

### Meta form

**Name**
```
return_declined
```

**Header — Type**
```
None
```

**Body**
```
Dear {{1}},

After reviewing your return request for order {{2}}, we're unable to approve it at this time.

Reason: {{3}}

If you'd like to discuss this further, please reply to this message or write to studio@srilatha.art.

Sincerely,
Srilatha Art
```

**Body — sample variable values**
```
{{1}} = Sunita Devi
{{2}} = 20260604153045
{{3}} = The piece was reported damaged beyond our return-window policy of 7 days.
```

### Variables sent at runtime

| Position | Source | Example |
|---|---|---|
| `{{1}}` | `order.customerName` | `Sunita Devi` |
| `{{2}}` | `order.rowKey` | `20260604153045` |
| `{{3}}` | `body.declineReason` (admin input on return-decline endpoint) | `The piece was reported damaged beyond our return-window policy of 7 days.` |

### Where it's enqueued

- [functions/orderAdmin.ts](../../backend/src/functions/orderAdmin.ts) `adminDeclineReturn` — `POST /api/admin/orders/{id}/return/decline`

---

# 8. `review_request` 🟡 READY

**Purpose:** delayed prompt (72h after delivery, via `review-requests`
queue visibility timeout) inviting the customer to share a review or
photo.

### Meta form

**Name**
```
review_request
```

**Header — Type**
```
None
```

**Body**
```
Dear {{1}},

We hope you're loving your piece from order {{2}} ✨

Each piece we make is a labor of love — we'd be honoured if you shared a review or a photo of how it lives in your space.

You can reply here, write to studio@srilatha.art, or tag us on Instagram @srilatha.art.

Sincerely,
Srilatha Art
```

**Body — sample variable values**
```
{{1}} = Sunita Devi
{{2}} = 20260604153045
```

### Variables sent at runtime

| Position | Source | Example |
|---|---|---|
| `{{1}}` | `order.customerName` | `Sunita Devi` |
| `{{2}}` | `orderId` (the order whose delivery scheduled the request) | `20260604153045` |

### Where it's enqueued

- [functions/orderAdmin.ts](../../backend/src/functions/orderAdmin.ts) `adminUpdateStatus` → `enqueueReviewRequest` — when admin transitions to `DELIVERED`
- Lands on the separate `review-requests` queue (visibility timeout = 72h)

---

# Implementation gap (must close before READY → LIVE)

The seven templates marked 🟡 READY have **no queue consumer case in
[functions/notificationsQueue.ts](../../backend/src/functions/notificationsQueue.ts)** today —
the consumer only handles `order_confirmation_new_artwork`. Until each
case is added, messages enqueued for these templates trigger a
`[notify] no handler for ...` warning and get silently dropped (not
sent to the poison queue, just gone).

The `review_request` template additionally has **no queue trigger
function** subscribed to the `review-requests` queue — so it never
even gets read.

To go from READY → LIVE on a given template:

1. Approve the template in WhatsApp Manager using the spec above.
2. Add a `case 'order_crafting':` (etc.) inside the `processNotification`
   switch in [functions/notificationsQueue.ts](../../backend/src/functions/notificationsQueue.ts).
3. Wire it through `sendTemplateMessage` with the correct `bodyVariables`
   order from this file's Variables table.
4. Log the outbound row + bump the conversation rollup (same pattern as
   `sendWhatsAppConfirmation`).
5. For `review_request`: also add a queue-trigger function on the
   `review-requests` queue.

Tracked as [TODO §D](../TODO-2026-06-04.md).
