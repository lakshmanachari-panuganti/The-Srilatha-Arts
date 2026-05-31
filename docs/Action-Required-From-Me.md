# Action Required From You

This document tracks open product / business decisions where I need your input before I can design or build cleanly. Once you answer, I'll fold the decisions into the relevant plan doc and clear the item from this list.

---

## Topic: Admin Order Management + Returns + Refunds

**Context.** You asked for admin-portal capabilities to:

- View customer orders
- Move an order through statuses (Confirmed → Shipped → ...)
- Adding a shipment/tracking number should itself flip the status to **Shipped**
- Accept return requests
- On accepting a return, process a refund — for online payments back to the original instrument, for COD via UPI to the customer's UPI ID

Before I design the data model, state machine, and UI, I need answers to the following.

---

### 1. Order status flow — what intermediate states do you want?

Pick the lifecycle you want admins (and the system) to drive orders through. Examples:

- **Minimal:** Confirmed → Shipped → Delivered → (optional) Return Requested → Return Accepted → Refunded
- **With packing step:** Confirmed → Processing → Packed → Shipped → Delivered → ...
- **Other:** describe

Also: **Delivered** — is that admin-set, or auto-set after N days post-Shipped, or driven by the courier (manual paste of "delivered" from the tracking provider)?

> Your answer:

---

### 2. Who initiates a return — customer or admin?

Options:

- **Customer self-service** from their account → an admin sees the request and approves/rejects
- **Admin/support only** (customer emails/WhatsApps, admin raises the return on their behalf)
- **Both** allowed

And: should there be a **return window** (e.g. only within 7 days of Delivered)? After that, the option is hidden from the customer and blocked on the admin side too?

> Your answer:

---

### 3. Online refund mechanism

For orders paid online (card / UPI / netbanking), do you have a payment gateway integrated, or planned?

- **Razorpay** — has a clean refund API; we can call it from the backend on "Return Accepted"
- **Stripe**
- **PayU / Cashfree / other**
- **Not yet integrated** — for now, mark refund as *Pending* and admin processes externally + clicks "Mark Refunded"

If a gateway is in place, do you want the refund **fully automatic** on accept, or a separate "Issue Refund" button after accept (two-step, for safety)?

> Your answer:

---

### 4. COD refund — manual UPI, or automated payouts?

For COD orders the customer already paid cash, so we have to send money out. Two routes:

- **Manual** — admin sees the customer's UPI ID (we'll capture it as part of the return request), pays via GPay/PhonePe/their bank app, then clicks **"Mark Refunded"** and pastes the UTR/reference number for records
- **Automated** — use a payout API (Razorpay Payouts, Cashfree Payouts) so the backend sends UPI directly when admin accepts the return

Manual is faster to build and zero new compliance; automated is nicer but needs a payout-account KYC.

> Your answer:

---

### 5. Partial returns?

If an order has 3 items, can the customer return just 1, or is it return-the-whole-order only?

- **Whole order only** (simpler — refund = order total)
- **Per-line-item** (return request carries which items + quantities; refund = sum of those lines)

> Your answer:

---

### 6. What exists today?

I haven't audited the current backend/admin yet for orders. Before I propose anything, do you want me to:

- **Audit first** — read existing order code, tables, and admin pages, then report what's already there vs. missing, so we design the gap
- **Greenfield it** — assume nothing's there and design the full thing; I'll reconcile with reality during implementation

> Your answer:

---

## How to use this file

- Answer inline under each "Your answer:" prompt, or send me the answers in chat — either works
- Once a topic is fully answered, I'll archive that section (move to `docs/decisions/` with a date) and clear it from here
- New open questions get appended as new top-level **Topic:** sections
