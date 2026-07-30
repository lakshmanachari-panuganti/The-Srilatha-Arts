# Launch TODO — Srilatha Art website

Pre-launch operational tasks tracked here. Code-level work is captured in
PR descriptions and merged via the normal flow; this file collects the
**studio-side / ops / config tasks** that gate public launch.

Last updated: 2026-06-11

---

## Analytics

The frontend has GA4 + Meta Pixel scaffolding wired (`components/analytics/
AnalyticsProvider.tsx`) with a consent gate, but the scripts are inert
until the production env vars are set. Until then:

- The provider renders nothing (no scripts, no consent banner).
- The `trackEvent` shim in `components/marketing/v2/shared/analytics.ts`
  no-ops gracefully — Studio Vault CTAs continue to work; events simply
  don't emit yet.
- Backend payment / webhook custom telemetry to App Insights is already
  wired and active (independent of GA4 / Meta).

### Tasks

- [ ] Create Google Analytics (GA4) property for `srilatha.art`
- [ ] Create Meta Pixel for `srilatha.art`
- [ ] Configure production environment variables on the Static Web App:
    - `NEXT_PUBLIC_GA4_ID` = `G-XXXXXXXXXX`
    - `NEXT_PUBLIC_META_PIXEL_ID` = `123456789012345`
- [ ] Verify the consent banner appears on first visit after deploy
- [ ] Verify Accept loads GA4 + Pixel scripts (DevTools → Network → `gtag/js` + `fbevents.js`)
- [ ] Verify Reject *does not* load either script
- [ ] Verify a `view_item` event fires from a PDP after consent (GA4 → Realtime)
- [ ] Verify `add_to_cart` fires from a Featured Works plate (GA4 → Realtime)
- [ ] Verify `Contact` fires on a WhatsApp inquiry tap (Meta Events Manager → Test Events)

---

## Email deliverability

Order confirmations + invoice attachments + review-request emails all flow
through the SMTP configuration in `backend/local.settings.example.json`.
Deliverability is unverified — without SPF/DKIM/DMARC the studio's
confirmation emails likely land in Gmail Promotions or Spam, which destroys
perceived professionalism on the customer's first impression after payment.

### Tasks

- [ ] Confirm the SMTP sender domain (e.g. `studio@srilatha.art`)
- [ ] Publish SPF record allowing the SMTP provider's sending IPs
- [ ] Enable DKIM signing on the provider; publish the public key in DNS
- [ ] Publish DMARC record (recommended: `v=DMARC1; p=quarantine; rua=mailto:postmaster@srilatha.art`)
- [ ] Send a test order confirmation through https://mail-tester.com — target ≥ 9/10
- [ ] Confirm a real order confirmation lands in Gmail Inbox (not Promotions, not Spam)
- [ ] Confirm the invoice PDF attachment opens correctly from the email
- [ ] Add a "delivered confirmation" send via the order state machine (24h after DELIVERED)

---

## Application Insights monitoring + alerts

App Insights is provisioned by the deploy script and the Function App's
managed identity has the `Monitoring Metrics Publisher` role. Backend now
emits `payment.captured`, `webhook.signature_failed`, and tracked exceptions
from `finalize_after_payment`. The alert rules need to be created in the
Azure Portal.

### Tasks

- [ ] Create an Availability Test against `https://func-thesrilathaarts-prd.azurewebsites.net/api/health`
    - Frequency: every 5 minutes
    - Locations: 3 regions (recommend Mumbai + Singapore + Sydney)
    - Success criteria: HTTP 200, response time < 5s
- [ ] Alert: any Availability Test failure → email to studio operations
- [ ] Alert: `customEvents` where `name == "webhook.signature_failed"` count > 0 in 15 min → email
- [ ] Alert: `customEvents` where `name == "payment.captured"` count == 0 in 24 hours during business hours → email (catches a quiet payment failure)
- [ ] Alert: any new `exceptions` row → email
- [ ] Verify the `/api/health` endpoint returns `status: "ok"` when called in production
- [ ] Verify `payment.captured` shows up in App Insights → Logs → `customEvents` after a successful test order

---

## Product catalogue — create Studio Vault pieces in Admin

The Studio Vault rooms reference Vermilion Tide (Plate I in Featured Works,
the subject of Process Film) and four other pieces, but the `productId`
fields are placeholder slugs. **Decision (2026-06-11):** create real
catalogue products for these Studio Vault pieces via Admin Portal so they
are first-class products; once created, wire the real IDs in.

### Tasks (Admin Portal — studio side)

- [ ] Create catalogue product: **Vermilion Tide** (resin & gold leaf on birch panel · 22 × 30 in · ₹68,000 · stockQty 1)
- [ ] Create catalogue product: **Concentric Devotion** (acrylic & ink on canvas · 24 × 24 in · ₹42,000 · stockQty 1)
- [ ] Create catalogue product: **White Threshold** (chalk-ink on dyed cotton · 16 × 16 in · ₹28,000 · stockQty 1)
- [ ] Create catalogue product: **Salt Witness** (resin, sand & gold leaf on panel · 20 × 26 in · ₹58,000 · stockQty 1)
- [ ] Create catalogue product: **Doorway VII** (lippan clay, mirror & gold leaf · 14 × 20 in · ₹46,000 · stockQty 1)

### Tasks (code — once IDs exist)

- [ ] Capture the real catalogue ID for each piece
- [ ] Update `processFilmData.ts` (`PIECE.productId`) with the real Vermilion Tide ID
- [ ] Update `FeaturedWorks.tsx` `WORKS` array — replace all 5 placeholder slug productIds with real IDs
- [ ] Verify Buy Now from Featured Works Plate I successfully adds to cart and lands on `/checkout`
- [ ] Verify Add to Cart opens the drawer
- [ ] Verify Inquire on WhatsApp prefills the message with the real piece title

---

## Notifications — dual-channel + studio CC

Customer-facing transactional events now fire WhatsApp + email in
parallel, with the studio CC'd on every email. Centralised via the
template registry in `backend/src/services/emailTemplates/registry.ts` —
all dispatch flows through there.

### Tasks (env / config)

- [ ] Set `STUDIO_NOTIFICATION_CC` on the prd Function App. Comma-separated. Recommended: `studio@srilatha.art`
- [ ] (Optional) Add a second BCC for ops handover, e.g. `studio@srilatha.art,admin@srilatha.art`
- [ ] Gmail-side: add a filter on `cc:studio@srilatha.art` → sub-label `srilatha-art/customer-audit` so the audit volume doesn't flood the primary inbox
- [ ] Set `RESERVATION_TIMEOUT_MINUTES` to 30 (or leave unset for the default)
- [ ] Set `STUDIO_ADMINS_WHATSAPP_GROUP` on the prd Function App. WhatsApp numbers (E.164 or `+91 …`) that should receive the `admin_notification_v1` template every time a customer submits a Custom Order request, **and** the `admin_new_order_v1` template every time a payment is captured on a shop order. **Separate entries with a comma or semicolon — not a space**, since spaces are legal inside a single number. Entries that don't normalise to 10–15 digits are ignored; failures to notify one admin do not stop the rest. Leave unset to disable both fan-outs. Delivery is queue-backed (`notifications-out`), so a transient Meta failure retries and a final failure raises a row on the admin dashboard's Notification Alerts card.

### Tasks (Meta Business Manager — WhatsApp template approvals)

Templates exist in code and the dispatcher will fire both channels the
moment Meta approval lands. Templates that need to go from 🟡 READY → ✅ LIVE:

- [ ] `order_crafting`
- [ ] `order_shipped`
- [ ] `order_cancelled`
- [ ] `order_on_hold`
- [ ] `order_refunded`
- [ ] `order_delivered` (NEW — needs to be authored + submitted in Meta)
- [ ] `review_request`
- [ ] `return_declined` (existing READY template, not yet wired to a transition handler)
- [ ] `admin_notification` (NEW — studio-facing custom-order arrival ping; body variables `{{1}}` customer name, `{{2}}` mobile number; static URL button pointing at `/admin/custom-orders`. Full copy in `docs/TODO/Create_whatsapp_templates/9. admin_notification.txt`)
- [ ] `admin_new_order_v1` (NEW — studio-facing **shop order** arrival ping, fires from `finalizeOrderAfterPayment` once payment is captured. Same two body variables as `admin_notification`: `{{1}}` customer name, `{{2}}` mobile number. Suggested body: `New order placed. Customer: {{1}}. Mobile: {{2}}. Open the admin dashboard for full details.` Category UTILITY, language `en`, static URL button pointing at `/admin/orders`. Until this is approved in Meta the send fails per-admin and is logged; nothing else breaks. To ship before approval, point `ADMIN_NEW_ORDER_TEMPLATE_KEY` in `backend/src/services/adminNotifications.ts` at `admin_notification_v1`.)

The WhatsApp template body wording for each is in `docs/templates/template_definition.md`. The
matching email versions auto-generate from `backend/src/services/emailTemplates/*.ts` — wording
intentionally mirrors WhatsApp so customers see consistent messages across channels.

### Tasks (verification after deploy)

- [ ] Place a real test order; confirm WhatsApp + email + invoice PDF all land
- [ ] Verify studio receives the order-confirmation email as CC (not BCC — CC by design)
- [ ] Walk an order through every status transition (CRAFTING → SHIPPED → DELIVERED) and verify both channels fire each time
- [ ] Force a stale reservation (place an order, abandon Razorpay Checkout for 30+ min); verify staleReservationCleanup cancels the order and restores stock
- [ ] Issue a test refund via Razorpay dashboard; verify both customer channels + studio CC fire on `refund.processed`

---

## Studio Vault asset uploads (optional / progressive enhancement)

Room 04 ships with `Blueprint` placeholders for all five chapters; these
read as intentional museum-card dividers and don't block launch. As the
studio's photography archive grows, drop assets and edit a single line per
chapter in `processFilmData.ts` to upgrade.

### Tasks

- [ ] (45 min phone shoot) Capture five chapter stills for Vermilion Tide
- [ ] Drop JPGs at `/public/process-film/vermilion-tide/` (matching the names referenced in `processFilmData.ts` once filled)
- [ ] Edit each chapter's `media: { type: 'blueprint' }` → `{ type: 'still', src, alt }`
- [ ] (Later, optional) 6–10 second video clips per chapter — same swap pattern
- [ ] Refine chapter `body` copy with Srilatha's voice (my drafts ship as fallback)

---

## Image optimisation pipeline

The build runs `scripts/optimize-images.mjs` which generates `.webp`
companions for `.jpg` / `.jpeg` assets. The script's discovery glob needs
to include the new `/public/process-film/` subdirectory before the first
chapter photos are added (otherwise the room renders the JPG without the
WebP fallback path that `PictureImage` expects).

### Tasks

- [ ] Verify `scripts/optimize-images.mjs` discovers `/public/process-film/**/*.{jpg,jpeg}`
- [ ] If not, extend the script's glob and confirm WebP companions are generated on `npm run images`

---

## Studio operations — post-purchase content engine

The post-purchase pipeline (priority 1) extends the existing review system
so that customer photos + room context flow into Room 07 (when built). The
*code* for this is on the backlog; the *operational* prerequisites are:

- [ ] Source the "Collector's Postcard" supply (hand-numbered prints, kraft envelopes, twine)
- [ ] Draft the post-delivery WhatsApp template asking for a photo + experience share
- [ ] Confirm in writing with Srilatha the consent defaults: "first name + city, never address, never full name, anonymisation available"

---

## Already done (no action needed)

- [x] **Cookie domain mismatch** — host-only cookies + Authorization: Bearer fallback
- [x] **X-Forwarded-For IP spoof** — `getClientIp` uses rightmost XFF / `x-azure-clientip`
- [x] **Invoice URL IDOR** — HMAC token required for post-cutover invoices, 404 on enumeration
- [x] **PDP sticky Buy Now bar** — `components/shop/StickyCartBar.tsx` is live and used
- [x] **PDP Product + Offer JSON-LD** — injected in `ProductDetailClient.tsx` after data resolves
- [x] **Root Organization + WebSite JSON-LD** — in `app/layout.tsx`
- [x] **`/api/health` endpoint** — `backend/src/functions/health.ts`
- [x] **App Insights backend telemetry shim** — `backend/src/utils/telemetry.ts`, wired in `payments.ts`
- [x] **`/api/reviews/recent` endpoint** — public sitewide approved reviews
- [x] **`/reviews` page on real API** — empty-state is honest, not mock
- [x] **Homepage Testimonials on real API** — renders nothing when no real reviews exist
