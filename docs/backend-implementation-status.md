# Backend Implementation Status

> Last reviewed: 2026-05-13 by full-stack audit of [backend-plan.md](backend-plan.md) vs. repo code.

## Phase 1: Foundation Backend — ✅ Complete

| Item | Plan Reference | Status | Files |
|------|---------------|--------|-------|
| Announcement bar public GET | §7 | ✅ Done | `announcements.ts` |
| Announcement admin CRUD | §7 | ✅ Done | `announcements.ts` |
| `orderEvents` table + append | §2.1 | ✅ Done | `tableStorage.ts` |
| Order state-machine service | §12 | ✅ Done | `services/orderState.ts` |
| `GET /api/orders/{id}` owner-OR-admin | §4.1 | ✅ Done | `orders.ts` |
| `GET /api/orders/me` | §4.1 | ✅ Done | `orders.ts` |

## Phase 2: Commerce + Order Management — ⚠️ Partial

| Item | Plan Reference | Status | Files |
|------|---------------|--------|-------|
| Orders PK=userEmail migration | §3 | ✅ Done | `tableStorage.ts` |
| 12-status state machine + transitions | §12 | ✅ Done | `services/orderState.ts` |
| Customer cancel / address / return | §4.1 | ✅ Done | `orders.ts` |
| Customer order events timeline | §4.1 | ✅ Done | `orders.ts` |
| Admin list orders (status filter, search, pagination) | §5.1 | ✅ Done | `orderAdmin.ts` |
| Admin order detail (items + events + next states) | §5.1 | ✅ Done | `orderAdmin.ts` |
| Admin status PATCH via state machine | §5.1 | ✅ Done | `orderAdmin.ts` |
| Admin internal notes | §5.1 | ✅ Done | `orderAdmin.ts` |
| Admin bulk status | §5.1 | ✅ Done | `orderAdmin.ts` |
| Admin audit log writes | §5.1 | ✅ Done | `orderAdmin.ts` |
| Coupon validate (rate-limited) | §6 | ✅ Done | `coupons.ts` |
| Coupon admin CRUD + redemptions | §6 | ✅ Done | `coupons.ts` |
| Cookie auth helpers (`buildAuthCookie`) | §9 | ✅ Done | `services/auth.ts` |
| CSRF service | §9 | ✅ Done | `services/csrf.ts` |
| Queue service (enqueue notifications) | §10 | ✅ Done | `services/queue.ts` |
| Rate limiting service | §10 | ✅ Done | `services/rateLimit.ts` |
| **Razorpay integration + webhook** | §8.1 | ❌ Missing | No `payments.ts` |
| **WhatsApp Cloud API client** | §10 | ❌ Missing | No `services/whatsapp.ts` |
| **ACS Email client** | §10 | ❌ Missing | No `services/email.ts` |
| **Invoice PDF generation** | §8.3 | ❌ Missing | No `invoice.ts` / `services/pdf.ts` |
| File upload (admin + customer) | §5.2 | ✅ Done | `upload.ts` — `POST /api/admin/upload`, `POST /api/upload/customer` (blob storage) |
| Notification queue trigger handler | §11.1 | ❌ Missing | No `processNotification` function |
| Webhook queue trigger handler | §11.1 | ❌ Missing | No `processWebhook` function |

## Phase 3: Custom Orders + Reviews — ✅ Complete

| Item | Plan Reference | Status | Files |
|------|---------------|--------|-------|
| Custom order public POST (rate-limited) | §4.2 | ✅ Done | `customOrders.ts` |
| Custom order admin list + status update | §5.2 | ✅ Done | `customOrders.ts` |
| Review public GET by product | §4.2 | ✅ Done | `reviews.ts` |
| Review gated POST (DELIVERED gate) | §4.2 | ✅ Done | `reviews.ts` |
| Review admin moderation + reply | §5.2 | ✅ Done | `reviews.ts` |
| Wishlist GET/POST/DELETE | §4.2 | ✅ Done | `wishlist.ts` |
| Addresses CRUD + default enforcement | §4.2 | ✅ Done | `addresses.ts` |

## Phase 4: Admin Expansion — ⚠️ Partial

| Item | Plan Reference | Status | Files |
|------|---------------|--------| ------|
| Basic admin stats (revenue, orders, AOV, customer count) | §5.2 | ✅ Done | `adminStats.ts` (`GET /api/admin/stats`) |
| Admin settings GET/PATCH | §5.2 | ❌ Missing | No endpoint; `config` table exists but unwired |
| Admin customer list | §5.2 | ❌ Missing | No endpoint; no `listAllUsers()` in tableStorage |
| Inventory / stock endpoints | §5.2 | ❌ Missing | Frontend reads `/products` directly (read-only) |
| Collections CRUD | §5.2 | ❌ Missing | |
| Categories CRUD | §5.2 | ❌ Missing | |
| Staff + role management | §5.2 | ❌ Missing | |
| Full analytics (revenue trend, top sellers, category breakdown) | §5.2 | ❌ Missing | `adminStats.ts` provides totals only |
| Shiprocket courier webhook | §8.2 | ❌ Missing | |

## Phase 5: Polish — ⚠️ Partial

| Item | Plan Reference | Status | Files |
|------|---------------|--------|-------|
| Rate limiting on coupon/validate + login | §10 | ✅ Done | `services/rateLimit.ts` |
| Review-request scheduler (timer trigger) | §11.2 | ❌ Missing | |
| `ordersByStatus` reconciliation timer | §11.2 | ❌ Missing | |
| Expired-orders cleanup timer | §11.2 | ❌ Missing | |
| App Insights alerts + workbooks | §16 | ❌ Missing | |

## Phase 6: V2 — ❌ Not Started

- [ ] API Management with rate-limit policies
- [ ] Azure Front Door + WAF
- [ ] Azure AI Search indexer for full-text product search
- [ ] SMS OTP for guest checkout

---

## Summary

**Current position: Phase 2 (70%) / Phase 3 (100%) / Phase 4 (15%)**

The core order management loop (create → track → cancel → return), coupons, announcements, custom orders, reviews, wishlist, and addresses are all implemented with proper backend endpoints. The order state machine with 12 statuses, transition validation, and audit logging is production-ready. A basic stats endpoint (`adminStats.ts`) exists for the admin dashboard. File upload for both admin and customer is live.

**`adminStats.ts` is NOT listed in any phase above** — it was created outside the plan. It provides: total revenue (paise), order count, avg order value, customer count, product count, pending/processing order counts via `GET /api/admin/stats`.

**Critical gaps before the checkout pipeline is end-to-end:**
1. **Razorpay payments** — no payment creation, verification, or webhook
2. **Notifications** — queue service exists but no actual WhatsApp/Email dispatch handlers
3. **Invoice PDF** — no generation or blob storage
4. **Courier integration** — no Shiprocket client or tracking webhook
5. **Admin settings endpoint** — `config` table exists; needs `GET/PATCH /api/admin/settings`
6. **Admin customer list** — `users` table exists; needs `GET /api/admin/customers` + `listAllUsers()` in tableStorage
