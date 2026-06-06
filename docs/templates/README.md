# WhatsApp templates

Copy-paste-ready spec for every WhatsApp Cloud API template the app
expects.

## Files

| File | Purpose |
|---|---|
| [template_definition.md](./template_definition.md) | All eight WhatsApp templates, one section each, formatted to map straight onto Meta's "Create template" form (Name / Header / Body / Sample values / Variables / Where it's enqueued). |

## At a glance

| # | Template | Status | Trigger |
|---|---|---|---|
| 1 | `order_confirmation_new_artwork` | ✅ LIVE | Razorpay payment.captured |
| 2 | `order_crafting` | 🟡 READY | Admin moves order → `CRAFTING` |
| 3 | `order_shipped` | 🟡 READY | Admin moves order → `SHIPPED` |
| 4 | `order_cancelled` | 🟡 READY | Admin moves order → `CANCELLED` |
| 5 | `order_on_hold` | 🟡 READY | Admin moves order → `ON_HOLD` |
| 6 | `order_refunded` | 🟡 READY | Admin moves order → `REFUNDED` |
| 7 | `return_declined` | 🟡 READY | Admin declines a return |
| 8 | `review_request` | 🟡 READY | 72h after order is `DELIVERED` (via `review-requests` queue) |

**LIVE** = approved in WhatsApp Manager AND a queue handler in
[functions/notificationsQueue.ts](../../backend/src/functions/notificationsQueue.ts)
delivers it.

**READY** = code already enqueues the template key, but either the
template isn't approved upstream yet OR the queue consumer has no
handler case yet. Both must close before the template fires for
customers. See the "Implementation gap" section at the bottom of
`template_definition.md`.

Email templates (e.g. `order_confirmed`) are intentionally NOT in this
folder — they're not created in any external console, just built in
code at [services/emailTemplates/](../../backend/src/services/emailTemplates/).

## Editing rule

If you edit a body in WhatsApp Manager, copy the change back into the
matching section of `template_definition.md` **in the same commit**
so the docs don't drift.
