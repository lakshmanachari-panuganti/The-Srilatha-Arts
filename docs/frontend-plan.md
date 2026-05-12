# The Srilatha Arts — Mobile-First Frontend Redesign

> An end-to-end blueprint for rebuilding **thesrilathaarts.com** as a **mobile-first**, **immersive**, premium online shopping experience for Resin · Dot Mandala · Lippan · Pichwai · Kolam handcrafted art — with a complete admin panel spec.

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Mobile-First Principles](#2-mobile-first-principles)
3. [Immersive UI Direction](#3-immersive-ui-direction)
4. [Information Architecture & Sitemap](#4-information-architecture--sitemap)
5. [Navigation Structure](#5-navigation-structure)
6. [Announcement Marquee Bar](#6-announcement-marquee-bar)
7. [Customer-Facing Pages (spec)](#7-customer-facing-pages-spec)
8. [Coupons & Discounts](#8-coupons--discounts)
9. [Admin Panel (spec)](#9-admin-panel-spec)
10. [Component System](#10-component-system)
11. [State Management & Data Layer](#11-state-management--data-layer)
12. [Performance, PWA & SEO](#12-performance-pwa--seo)
13. [Accessibility & i18n](#13-accessibility--i18n)
14. [Tech Choices & Folder Structure](#14-tech-choices--folder-structure)
15. [Migration Plan from Current Code](#15-migration-plan-from-current-code)
16. [Phased Roadmap](#16-phased-roadmap)

---

## 1. Design Philosophy

**Tagline carry-over:** *Where Tradition Meets Creativity.*

**Three guiding principles:**

| Principle | What it means in practice |
|---|---|
| **Touch as the primary input** | Every interaction must work with one thumb. Buttons ≥ 44×44 px. Swipe > tap-tap-tap. No hover-only affordances. |
| **Art is the hero, chrome disappears** | Photography is full-bleed. Chrome (header, nav) is translucent / collapses on scroll. UI gets out of the way. |
| **Slow, deliberate, premium** | Soft motion curves (≥ 400 ms ease-out), generous whitespace, serif typography for headlines. Never feels "appy" — feels like a gallery you can hold. |

**Brand palette (keep — it works):**

```
--primary-dark   #8B3A0E   (terracotta base)
--primary-burnt  #A14B1A   (warm accent)
--gold           #D4AF37   (CTA / accent)
--gold-light     #F4E5B0   (highlights)
--cream          #FFF8F0   (light surfaces)
--ink            #1A0F08   (text on cream)
```

**Type system:**

- Display / H1–H3 → **Cormorant Garamond** (serif, 500/600)
- Body / UI / buttons → **Montserrat** (sans, 400/500/600)
- Optional accent → **Caveat** for hand-written touches like signatures, "made by hand" stamps

**Mobile baseline type scale (mobile-first):**

```
xs    11 px    micro-labels, badges
sm    13 px    captions
base  15 px    body  (NOT 16 — feels lighter on phone)
lg    17 px    intro paragraphs
xl    20 px    sub-headings
2xl   24 px    section labels
3xl   30 px    page titles (mobile H1)
4xl   38 px    hero (mobile)
```

Then scale up via `md:` and `lg:` *additively* — not the other way round.

---

## 2. Mobile-First Principles

The current site has `lg:grid-cols-2`, `min-h-screen`, `text-5xl sm:text-6xl lg:text-7xl` — i.e. **the desktop view is the source of truth and mobile gets the leftovers**. We flip this.

### Tailwind conventions to enforce

```
// ❌ desktop-first
className="text-5xl sm:text-4xl"           // shrink for mobile
className="grid-cols-3 md:grid-cols-1"     // collapse for mobile

// ✅ mobile-first  (NEW RULE)
className="text-3xl md:text-5xl lg:text-7xl"
className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
```

Hard rules in the new codebase:

1. **No utility may appear without a base (mobile) value.** `md:p-8` alone is banned — must be `p-4 md:p-8`.
2. **No fixed widths in px** below the `md:` breakpoint. Use `w-full`, `max-w-*`, or flex/grid.
3. **No `min-h-screen` on hero.** Use `min-h-[100svh]` (small viewport height — fixes iOS Safari URL-bar jump).
4. **Touch targets ≥ 44×44 px.** Tailwind: `min-h-11 min-w-11` (`h-11 = 44px`).
5. **Safe-area padding for iOS notch & home indicator:**
   ```css
   padding-bottom: max(1rem, env(safe-area-inset-bottom));
   ```
6. **No hover-only states.** Every `hover:` must have an equivalent `active:` or `aria-current` state.
7. **Sticky bottom CTA on product pages.** Mobile users don't scroll back up — the "Add to Cart" must stay reachable.
8. **Tap-friendly horizontal scroll** for category chips & related products (`snap-x snap-mandatory`).
9. **Lazy-load everything below the fold.** `loading="lazy"` + `next/image` with proper `sizes`.
10. **Test on real devices.** iPhone SE (375 px) and Pixel 5 (393 px) are the lowest reasonable widths.

### Breakpoints (Tailwind defaults — fine):

| Token | Width | Devices |
|---|---|---|
| (default) | 0–639 | All phones |
| `sm` | 640+ | Large phones landscape, small tablets |
| `md` | 768+ | Tablets portrait |
| `lg` | 1024+ | Tablets landscape, small laptops |
| `xl` | 1280+ | Desktop |
| `2xl` | 1536+ | Large desktop |

---

## 3. Immersive UI Direction

The word "immersive" means: **the customer should feel they walked into a gallery, not opened an app.** Practical techniques:

### 3.1 Photography & artwork as full-bleed canvas

- Hero is **a 9:16 portrait video / parallax image of the artist's hand finishing a Dot Mandala** — sound off, autoplay, looping, < 3 MB, served via blob storage.
- Category cards are full-bleed, with the title sliding in from the bottom on mount (intersection observer).
- Product page opens to a **full-screen image gallery with pinch-zoom** (use `react-zoom-pan-pinch` or build with framer-motion).

### 3.2 Storytelling moments

- **Scroll-driven reveal** on the home page: as you scroll, the screen transitions between art forms (Resin → Mandala → Lippan → Pichwai) — each becomes the background with a one-line poetic caption.
- **Artist signature** drawn live with `framer-motion`'s `pathLength` animation in the About page.
- **Loading state = an animated Kolam dot pattern** drawing itself (you already have `KolamLoader.tsx` — keep/extend).

### 3.3 Tactile micro-interactions

| Interaction | Feel |
|---|---|
| Add to cart | Bag icon scales + golden particle burst (CSS keyframes, no library) |
| Wishlist tap | Heart fills + tiny haptic (`navigator.vibrate(15)`) |
| Card swipe in gallery | Snap with spring physics, drag-to-dismiss for modals |
| Bottom-tab change | Icon scales 1 → 1.15 with `whileTap` |
| Form errors | Subtle shake + red glow under field, not a banner |
| Order placed | Full-screen success with a hand-drawn Kolam completing itself |

### 3.4 Premium polish

- **Glassmorphism** on the header & bottom tab bar — already in place via `backdrop-blur`. Keep.
- **Subtle grain texture** overlay at 3 % opacity (already in mobile drawer — extend site-wide).
- **Gold foil shimmer** on price tags and "Best Seller" badges — use the existing `@keyframes shimmer`.
- **Page transitions** with `framer-motion`'s `AnimatePresence` + a shared `key` based on `pathname`. Fade + 8 px slide-up, ~ 250 ms.
- **Dark/light mode optional.** The terracotta+cream pairing is gorgeous in both — but ship dark-only V1 to keep scope tight.

---

## 4. Information Architecture & Sitemap

```
Public
├── /                              Home
├── /shop                          All products (renamed from /gallery)
│   ├── /shop/resin-art
│   ├── /shop/dot-mandala
│   ├── /shop/lippan-art
│   ├── /shop/pichwai-art
│   └── /shop/kolam-art
├── /collections                   Curated bundles (e.g. "Diwali Picks")
│   └── /collections/[slug]
├── /product/[id]                  Product detail
├── /new-arrivals
├── /best-sellers
├── /sale                          Discounted items
├── /custom-order                  Talk to Us About a Custom Order
├── /our-story                     About (renamed for warmth)
├── /the-craft                     Educational: how each art form is made
│   ├── /the-craft/resin
│   ├── /the-craft/dot-mandala
│   ├── /the-craft/lippan
│   └── /the-craft/pichwai
├── /care-guide                    How to care for each artwork type
├── /journal                       Blog (optional V2)
│   └── /journal/[slug]
├── /reviews                       Customer reviews + photos
├── /faq
├── /shipping-and-returns
├── /privacy-policy
├── /terms
├── /contact
└── /search                        Full-text search results

Account (gated)
├── /account                       Dashboard with active-order card
├── /account/orders                Order history + filters
├── /account/orders/[id]           Single order — items, timeline, tracking, actions
├── /account/orders/[id]/track     Full-screen kiosk-style tracker (shareable link)
├── /account/wishlist
├── /account/addresses
├── /account/coupons               Codes assigned to user + active public codes
├── /account/profile
└── /account/notifications

Auth
├── /login
├── /register
├── /forgot-password
└── /verify-otp

Checkout flow
├── /cart
├── /checkout                      Single-page accordion: address → ship → pay
└── /order-confirmation/[id]

Admin (gated /admin/*)
├── /admin/login
├── /admin/dashboard
├── /admin/orders
│   └── /admin/orders/[id]
├── /admin/products
│   ├── /admin/products/new
│   └── /admin/products/[id]/edit
├── /admin/inventory               Stock levels
├── /admin/categories
├── /admin/collections             Curated bundles management
├── /admin/customers
│   └── /admin/customers/[id]
├── /admin/custom-orders           Inquiries from /custom-order form
├── /admin/reviews                 Moderate reviews
├── /admin/coupons                 Discount codes
├── /admin/media                   Blob storage browser
├── /admin/content                 Static page content (FAQ, about, etc.)
├── /admin/analytics               Sales, traffic, AOV
└── /admin/settings
    ├── /admin/settings/general
    ├── /admin/settings/shipping
    ├── /admin/settings/payments
    ├── /admin/settings/staff
    ├── /admin/settings/notifications
    └── /admin/settings/announcement     Marquee banner CRUD (§9.15)

API routes (Azure Functions — already partially in place)
api/products                  GET, POST (admin)
api/products/:id              GET, PATCH (admin), DELETE (admin)
api/categories                GET, POST (admin)
api/collections               GET, POST (admin)

# Customer order management (§7.9)
api/orders                    POST (customer)
api/orders/me                 GET   list current user's orders
api/orders/:id                GET   owner only
api/orders/:id/events         GET   activity log (owner)
api/orders/:id/cancel         POST  (allowed states only)
api/orders/:id/address        PATCH (PLACED state only, one edit)
api/orders/:id/issue          POST  damaged/wrong/missing report
api/orders/:id/return         POST  return request
api/orders/:id/invoice        GET   signed-URL PDF
api/orders/:id/track-link     GET   public signed link

# Admin order management (§9.2)
api/admin/orders              GET   filtered list
api/admin/orders/:id          GET   detail
api/admin/orders/:id/status   PATCH advance status, body: { to, note, notifyCustomer, tracking }
api/admin/orders/:id/notes    POST  internal note
api/admin/orders/:id/refund   POST  partial/full refund
api/admin/orders/:id/message  POST  send WhatsApp/email
api/admin/orders/:id/events   GET   activity log (admin sees everything)
api/admin/orders/bulk-status  PATCH bulk advance
api/courier/webhook           POST  courier → status sync (Delhivery/Shiprocket)

api/cart                      GET, POST, DELETE (session-bound)
api/wishlist                  GET, POST, DELETE (user)
api/reviews                   GET, POST (user)
api/custom-orders             POST (public), GET/PATCH (admin)

# Coupons (§8)
api/coupons/validate          POST  cart → discount preview
api/admin/coupons             GET, POST
api/admin/coupons/:id         GET, PATCH, DELETE

# Announcement marquee (§6, §9.15)
api/announcements             GET   active banner items (public)
api/admin/announcements       GET, POST
api/admin/announcements/:id   GET, PATCH, DELETE

api/upload                    POST (admin, multipart → blob)
api/auth/*                    login, register, otp, refresh, me
api/admin/auth/*              admin login
api/analytics/*               admin only
```

---

## 5. Navigation Structure

### 5.1 Customer mobile (primary)

**Announcement marquee (sticky on top, 28 px, full spec in §6):**

```
✨  FLAT 30% OFF on all Resin Art · Use code SRILATHA30 · Free shipping above ₹2,999 ✨
   ←——————— scrolling right-to-left, continuous loop ———————←
```

**Top bar (sticky, glass, 56 px — sits *below* the marquee):**

```
[☰]   [TSA Logo — centered]   [🔍] [🛒²]
```

- Hamburger opens slide-in drawer (categories, account, policies)
- Search icon → full-screen search overlay
- Cart shows badge with item count

**Bottom tab bar (sticky, glass, 64 px + safe-area):**

```
[ Home ]  [ Shop ]  [ + Custom ]  [ Wishlist ]  [ Account ]
   🏠       🛍️         ✨            ❤️           👤
```

- Center "Custom" is raised (FAB-style) — drives the highest-margin product line
- Active state: gold underline + label color shift
- Hides on scroll-down, returns on scroll-up (UX-standard pattern)

**Mobile drawer (left slide-in — extend the existing one):**

```
─ Shop ──────────────
  All Products
  Resin Art
  Dot Mandala
  Lippan Art
  Pichwai Art
  Kolam Art
─ Discover ──────────
  New Arrivals
  Best Sellers
  Collections
  Sale
─ The Craft ─────────
  How It's Made
  Care Guide
  Our Story
  Journal
─ Help ──────────────
  FAQ
  Shipping & Returns
  Contact
  WhatsApp Us
─ My Account ────────
  Sign In / Profile
  Orders
  Addresses
```

### 5.2 Customer desktop (≥ `lg`)

```
[Logo]   Shop ▾    New    Best    Custom   The Craft ▾    Journal   |   🔍  ❤️  🛒²  👤
```

- Mega-menu under **Shop ▾** with category thumbnails (4-col grid)
- Mega-menu under **The Craft ▾** with the four art-form story pages
- No bottom tab bar on desktop

### 5.3 Admin

**Mobile:** drawer + top bar (already in place — refine).
**Desktop:** persistent left sidebar (already in place — extend with new routes from §7).

---

## 6. Announcement Marquee Bar

A slim, premium ticker pinned to the very top of every public page that scrolls **right → left** (RTL motion = reading direction reversed, so the eye catches it; for an LTR site this is the conventional "ticker" direction). Use it for festival offers, flat % discounts, free-ship thresholds, and code reminders.

### 6.1 Visual & behaviour spec

| Property | Value |
|---|---|
| Position | `fixed top:0` (above the Header) |
| Height | **28 px** mobile / 32 px desktop |
| Background | Gold gradient `bg-gradient-to-r from-gold via-gold-light to-gold` |
| Text | `text-primary-dark`, `font-medium`, `text-[12px]` / `sm:text-[13px]`, tracking-wide |
| Motion | continuous translate-x loop, **30 s** per cycle, `linear`, infinite |
| Pause | `hover:[animation-play-state:paused]` on desktop · long-press on mobile |
| Dismiss | small `×` on the right; remembers dismissal for 24 h via `localStorage.tsa_marquee_dismissed_at` |
| Layout shift | Header & page content add `pt-7 sm:pt-8` while banner is visible — handled by a `BannerProvider` so it's a known token, not a magic number |
| Accessibility | wrap in `role="region" aria-label="Site announcements"`; provide `prefers-reduced-motion` fallback (static text, no scroll) |
| Tap | the whole banner is a `<Link>` that goes to `/sale` (or wherever admin configures) |
| Admin-driven | content, link, start/end date, color theme, and on/off all editable in `/admin/settings/announcement` (see §9) |

### 6.2 Content patterns (rotate via admin)

- `✨ FLAT 30% OFF on Resin Art · Code SRILATHA30 · Ends Sunday`
- `🎁 Free shipping on orders above ₹2,999 · Pan-India delivery`
- `🪔 Diwali Collection live · Handcrafted in Hyderabad with love`
- `🖼️ Custom commissions open · 2 slots left this month`

Keep each message ≤ 80 characters so the loop reads naturally on a 360 px screen.

### 6.3 Implementation snippet

```tsx
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'

interface Announcement {
  id: string
  message: string
  href: string
  active: boolean
}

export default function MarqueeBanner({ items }: { items: Announcement[] }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const dismissedAt = Number(localStorage.getItem('tsa_marquee_dismissed_at') || 0)
    setVisible(Date.now() - dismissedAt > 24 * 60 * 60 * 1000 && items.length > 0)
  }, [items.length])

  if (!visible) return null

  const dismiss = () => {
    localStorage.setItem('tsa_marquee_dismissed_at', String(Date.now()))
    setVisible(false)
  }

  // duplicate the list so the loop is seamless
  const loop = [...items, ...items]

  return (
    <div
      role="region"
      aria-label="Site announcements"
      className="fixed top-0 inset-x-0 z-[60] h-7 sm:h-8
                 bg-gradient-to-r from-gold via-gold-light to-gold
                 text-primary-dark overflow-hidden flex items-center"
    >
      <div className="flex-1 overflow-hidden">
        <div
          className="flex whitespace-nowrap will-change-transform
                     animate-marquee motion-reduce:animate-none
                     hover:[animation-play-state:paused]"
        >
          {loop.map((a, i) => (
            <Link
              key={`${a.id}-${i}`}
              href={a.href}
              className="mx-8 text-[12px] sm:text-[13px] font-medium tracking-wide"
            >
              ✨ {a.message}
            </Link>
          ))}
        </div>
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss announcements"
        className="px-2 h-full flex items-center hover:bg-primary-dark/10"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
```

Tailwind keyframe (add to `tailwind.config.js` under `extend.keyframes` + `extend.animation`):

```js
keyframes: {
  marquee: {
    '0%':   { transform: 'translateX(0)' },
    '100%': { transform: 'translateX(-50%)' },   // because we duplicated the list
  },
},
animation: {
  marquee: 'marquee 30s linear infinite',
},
```

> **Note on direction.** `translateX(0) → translateX(-50%)` moves the *content* leftward, which makes the visible text appear to flow **right-to-left** (the same direction as classic stock tickers / Amazon promo strips). If you literally want letters to enter from the *left edge* and exit on the right, swap to `100% → 0%` — but most users perceive the right-to-left version as more premium.

### 6.4 Mounting

Mount the marquee inside `ConditionalLayout.tsx` *above* `<Header />` for public routes only (skip on `/admin/*` and `/checkout` — checkout should be distraction-free).

---

## 7. Customer-Facing Pages (spec)

> Each page below lists: **purpose · mobile-first sections · key components · CTAs · data**.

### 7.1 Home `/`

**Purpose:** seduce. Communicate craft, range, and trust in ≤ 3 swipes.

**Sections (in mobile scroll order):**

1. **Hero** — 9:16 portrait video/photo, headline, primary CTA → /shop, secondary → /custom-order. Min-height `100svh`.
2. **Trust strip** — horizontal scroll of: ✓ Free ship ₹2,999+ · ✓ Handmade in Hyderabad · ✓ 7-day exchange · ✓ Secure pay · ✓ Custom orders.
3. **Shop by Art Form** — 2-col grid mobile / 4-col desktop. Each card → category page.
4. **Featured Creations** — horizontal snap carousel mobile, 3-col grid desktop.
5. **Scroll-story** — full-bleed art form reveal as you scroll (immersive).
6. **Bestsellers** — same pattern as featured.
7. **Our Story teaser** — image + 2-line excerpt + → /our-story.
8. **Custom Order CTA** — full-bleed, "Have a vision? We'll craft it." → /custom-order.
9. **Testimonials** — horizontal snap carousel with photos.
10. **Instagram strip** — pull latest 6 posts (Instagram Basic Display API).
11. **Newsletter signup** — inline, single email field, gold submit.
12. **Footer** — collapsed accordions on mobile, columns on desktop.

### 7.2 Shop `/shop` (rename from `/gallery`)

- Sticky filter bar (horizontal scroll chips on mobile): All · Resin · Mandala · Lippan · Pichwai · Kolam · New · Sale.
- Secondary filter sheet (bottom-sheet on mobile): Price range · Size · In stock · Sort.
- Grid: 2-col mobile, 3-col tablet, 4-col desktop.
- Infinite scroll (intersection observer), not pagination.
- Empty state with illustration.

### 7.3 Category `/shop/[category]`

- Hero band with the art form's signature image + 2-line origin story.
- Same product grid below, pre-filtered.
- "Learn how it's made" link → `/the-craft/[category]`.

### 7.4 Product `/product/[id]`

**Mobile layout (top-down):**

1. Sticky back arrow + share + wishlist (overlay on image).
2. **Full-width swipeable image gallery** (4:5 aspect). Pinch-zoom on tap.
3. Title + category chip.
4. Price (struck-through original if on sale) + "incl. taxes" line.
5. Size · Material · Time-to-make (3-pill row).
6. Quantity stepper.
7. **Sticky bottom CTA bar:** [Add to Cart] [Buy Now] — never scrolls away.
8. Description (expandable accordion).
9. "What makes it special" (icon list: handmade · one-of-a-kind · ships in 5 days).
10. Care instructions (link).
11. Reviews summary + carousel.
12. Related products (horizontal snap).
13. "Made by Srilatha" footer mini-card → /our-story.

### 7.5 Custom Order `/custom-order` (NEW — high value)

- Hero: "Tell us your vision."
- Multi-step form (one question per screen on mobile, accordion on desktop):
  1. Which art form? (visual picker)
  2. Size / dimensions
  3. Color palette (color swatches + free text)
  4. Occasion / story (textarea)
  5. Budget range (slider)
  6. Reference images (upload to blob)
  7. Contact (name, phone, email, city)
- Submit → creates `customOrder` row, sends WhatsApp + email notification to admin.
- Confirmation screen with "What happens next" timeline.

### 7.6 Cart `/cart`

- List items with image, title, size, price, qty stepper, remove.
- Coupon input (collapsible).
- Order summary (sticky bottom bar on mobile).
- Empty state with "Browse Shop" CTA.
- Persist via localStorage + sync to backend if logged in.

### 7.7 Checkout `/checkout`

Single-page **accordion on mobile**, two-column on desktop:

1. Contact (or "Continue as guest")
2. Shipping address (with pincode validation → auto city/state)
3. Shipping method (Standard ₹0 above ₹2,999 / Express +₹200)
4. Payment (Razorpay UPI/Card/Netbanking · COD)
5. Review & place order
- Order summary always visible (sticky right on desktop, sticky bottom on mobile).
- Trust badges below pay button.

### 7.8 Order Confirmation `/order-confirmation/[id]`

- Hero animation (Kolam draws itself), order #, ETA.
- Track order CTA, WhatsApp confirm CTA.
- "Save your account" prompt for guests.

### 7.9 Account & Order Management `/account/*`

Once a customer is logged in, they get a full self-service area. **Order management is the centerpiece** — customers must be able to find, track, modify (within policy), and re-buy any past order without contacting support.

#### 7.9.1 `/account` — overview dashboard

Mobile layout (top-down):

1. Greeting strip — *"Namaste, Priya"* + member-since date + loyalty tier badge.
2. **Active order card** — biggest card on screen; shows the most recent un-delivered order with a live status pill, current step in the timeline, ETA, and a one-tap **Track** CTA.
3. Quick-action grid (2×2): Orders · Wishlist · Addresses · Coupons.
4. Recommended for you (re-buy + similar to past purchases).
5. Need help? → WhatsApp / FAQ.

#### 7.9.2 `/account/orders` — order history

- Reverse-chronological list. Each row is a **swipeable card** on mobile:
  ```
  ┌──────────────────────────────────────┐
  │ [img] Dot Mandala — 12" Round         │
  │       Order #TSA-2026-00487           │
  │       Placed 8 May · ₹ 4,200          │
  │       🟡 Crafting · ETA 18 May        │
  │       [ Track ]  [ View ]             │
  └──────────────────────────────────────┘
  ```
- Filter tabs: **All · Active · Delivered · Cancelled · Returned**.
- Search by order ID or product name.
- Sort: most recent · highest value.
- Each card swipe-left reveals shortcuts: **Reorder** · **Get invoice** · **Contact support**.
- Empty state: *"No orders yet — your first masterpiece is one tap away"* with a Shop CTA.

#### 7.9.3 `/account/orders/[id]` — single order detail

This is the most important page in the customer's logged-in experience.

**Sections:**

1. **Header strip** — Order #, placed date, total, payment method, payment status (Paid · COD · Refund pending).
2. **Live status timeline** — vertical on mobile, horizontal on desktop. Six canonical steps with current step highlighted, completed steps with checkmarks, future steps dimmed:
   ```
   ●  Placed              8 May, 10:42 AM
   ●  Confirmed           8 May, 11:15 AM
   ◉  Crafting (current)  In progress · ETA 14 May
   ○  Packed
   ○  Shipped
   ○  Delivered
   ```
   Each step shows the timestamp + any admin note (e.g. *"Resin curing — will take 2 extra days"*).
3. **Items list** — image, title, size, qty, price, per-line *Reorder* link.
4. **Shipping address** + courier name + **tracking number** with a copy button and a deep link to the courier's tracker.
5. **Payment summary** — subtotal, discount (with coupon code shown), shipping, taxes, total.
6. **Invoice** — download PDF (server-generated, GST-compliant). Email me a copy.
7. **Actions** (visible based on order state):
   - **Cancel order** — only while status ∈ {Placed, Confirmed}; surfaces refund policy.
   - **Modify address** — only while status = Placed; one edit allowed.
   - **Report an issue** — opens a guided form (damaged · wrong item · missing · other) with photo upload → creates a support ticket.
   - **Request return / exchange** — only after Delivered and within 7 days; reason picker.
   - **Reorder** — clones items into cart.
   - **Rate & review** — only after Delivered; opens per-item review form.
   - **Contact on WhatsApp** — pre-fills `Hi, regarding order #TSA-2026-00487...`
8. **Activity log** — every status change + admin note, customer-visible, chronological.

**Notifications customer receives** (each maps to a status change — see §9.14):
- WhatsApp message + email + push (if PWA installed): Placed → Confirmed → Crafting → Packed → Shipped (with tracking #) → Out for delivery → Delivered → Review request (3 days later).

#### 7.9.4 `/account/orders/[id]/track` — public-style tracker

Same timeline as 7.9.3 but full-screen, kiosk-style, courier map embed if available, big ETA. Shareable via a signed link so customers can show family without logging them in.

#### 7.9.5 `/account/wishlist`

Grid of saved items · move-to-cart · remove · share list link.

#### 7.9.6 `/account/addresses`

CRUD addresses · mark default shipping / billing · validate pincode on save.

#### 7.9.7 `/account/coupons`

Codes assigned to the user (loyalty, birthday, win-back) + a feed of public codes currently active.

#### 7.9.8 `/account/profile`

Name, phone, email, DOB (for birthday coupon), password change, communication preferences (WhatsApp / email / push toggles), delete account.

#### 7.9.9 Order state model (shared with admin §9.2)

```
PLACED → CONFIRMED → CRAFTING → PACKED → SHIPPED → OUT_FOR_DELIVERY → DELIVERED
                                                                  ↘ RETURN_REQUESTED → RETURNED → REFUNDED
                              ↘ CANCELLED  (allowed before SHIPPED)
                              ↘ ON_HOLD    (admin-set, with reason)
```

Each transition is an immutable event row (`orderEvents` table): `orderId`, `from`, `to`, `at`, `by` (user/admin/system), `note`, `meta` (e.g. tracking #). The customer-facing timeline is rendered from this event log — single source of truth, same data the admin sees.

### 7.10 The Craft `/the-craft/[form]`

Long-form editorial page per art form: history, technique, gallery, video, "Shop this art form" CTA. SEO goldmine.

### 7.11 Reviews `/reviews`

Aggregated reviews wall with photo grid. Filter by art form. "Share your piece" submission form.

### 7.12 Static pages

`/faq` · `/shipping-and-returns` · `/privacy-policy` · `/terms` · `/contact` — each driven by markdown/MDX so admin can edit via the CMS panel.

---

## 8. Coupons & Discounts

Coupon codes are a first-class part of the checkout funnel, the cart, and the marquee banner. Treat them as a feature, not a free-text input bolted onto the order summary.

### 8.1 Coupon types (admin-configurable — §9.10)

| Type | Example | Use case |
|---|---|---|
| **Percentage off** | `SRILATHA30` → 30% off | Site-wide festival sale |
| **Flat amount off** | `WELCOME200` → ₹200 off | First-purchase incentive |
| **Free shipping** | `FREESHIP` | Below the free-ship threshold |
| **Buy X get Y** | `B2G1` → buy 2 mandalas get 1 free | Clear slow-moving stock |
| **Category-restricted** | `RESIN20` → 20% off Resin only | Push a single art form |
| **Tiered** | `TIER10/15/20` based on cart total | Increase AOV |
| **First-time only** | applies per phone/email once | Acquisition |
| **Auto-apply** | no code needed, applies if cart matches rule | Hidden delight |

Each coupon record stores: `code`, `type`, `value`, `minSpend`, `maxDiscount`, `validFrom`, `validTo`, `usageLimitTotal`, `usageLimitPerUser`, `applicableCategories[]`, `excludedProducts[]`, `firstTimeOnly`, `stackable`, `active`.

### 8.2 Where coupons appear in the customer flow

1. **Marquee banner** advertises the code (`Use code SRILATHA30`) — see §6.
2. **Product detail page** — if an *auto-apply* or category coupon is live, show a small green pill:
   ```
   💚  30% off applied at checkout with SRILATHA30
   ```
3. **Cart page** — collapsible "Have a coupon?" row with input + Apply button + applied chips.
4. **Checkout** — same coupon row, prominent in the order summary. See §7.7 for the redesigned checkout coupon UX below.
5. **Account / Wallet** — `/account/coupons` shows codes assigned to the user (loyalty, birthday, win-back).

### 8.3 Checkout coupon UX (mobile-first)

The coupon input lives **inside the sticky order summary**, immediately above the total, so it's visible without scrolling on a 375 px screen.

```
┌─────────────────────────────────────────┐
│  Order Summary                          │
│  ───────────────────────────────────    │
│  Subtotal              ₹ 4,200          │
│  Shipping              FREE             │
│                                         │
│  🎟  [ Enter coupon code   ] [ Apply ]  │
│                                         │
│  ✓ SRILATHA30 applied        −₹ 1,260   │
│    [remove]                             │
│  ───────────────────────────────────    │
│  Total                 ₹ 2,940          │
│                                         │
│  [        Place Order  →        ]       │
└─────────────────────────────────────────┘
```

**Behaviour:**

| Action | Result |
|---|---|
| Type code + Apply | `POST /api/coupons/validate` with `{ code, cartItems, userId }` → returns `{ valid, discount, message }` |
| Valid | success toast, chip slides in with strike-through on the old total, new total animates from old → new in 400 ms |
| Invalid | inline red error under field with explicit reason: *"This code expired", "Minimum order ₹3,000 required (add ₹520 more)", "Already used"* — never just "invalid" |
| Server suggests an auto-apply | when user lands on `/checkout` and a better unused public coupon applies, show a soft hint: *"Tip: code FREESHIP gives you free shipping"* with one-tap apply |
| Stacking | by default coupons are **not stackable**; if both are stackable per admin config, allow up to 2 chips |
| Anti-abuse | rate-limit `validate` to 5 attempts/minute/IP; lock account after 20 failed attempts in an hour |
| Removed | tap the chip's × → total reverts with the same animation reversed |

### 8.4 Server contract

```ts
// POST /api/coupons/validate
type ValidateReq = {
  code: string
  items: { productId: string; qty: number; price: number; category: string }[]
  userId?: string          // anonymous allowed
}

type ValidateRes =
  | { valid: true;  code: string; discountAmount: number; appliedTo: 'cart' | 'shipping'; message?: string }
  | { valid: false; reason: 'EXPIRED' | 'MIN_SPEND' | 'USED' | 'NOT_ELIGIBLE' | 'INVALID' | 'INACTIVE'; message: string }

// POST /api/orders   (final placement re-validates server-side — never trust client-side discount)
```

**Critical:** the final discount **must be recomputed on the server** during `POST /api/orders`. The client value is for display only. This stops a tampered client from sending `discount: 99%`.

### 8.5 Coupon analytics (admin §9.13)

Track per code: redemptions, GMV, redemption rate (views vs uses), avg order value with vs without, returning vs new buyers, top product categories purchased.

### 8.6 Marquee ↔ coupon link

When admin creates a coupon and toggles **"Promote in announcement bar"**, a marquee entry is auto-generated with the code embedded — keeping the banner and the actual live discount in sync (no more "the banner says 30% but the code doesn't work" complaints).

---

## 9. Admin Panel (spec)

> Currently you have dashboard + gallery. Below is the **complete** admin spec.

### 9.1 Dashboard `/admin/dashboard`

KPI cards (mobile = 2-col grid, desktop = 4-col):

- Revenue today / this week / this month
- **Orders pending fulfilment** (click → orders filtered to actionable statuses)
- **Orders shipped today / arriving today** (so admin knows what to watch)
- Low-stock items (< 2 in stock)
- New custom-order inquiries
- New unread reviews

Charts (responsive):
- Revenue last 30 days (area chart, Recharts)
- Orders by status (donut: Placed · Crafting · Packed · Shipped · Delivered · Cancelled)
- Top-selling products (bar)
- Traffic source (if GA hooked up)

**Live activity feed** (right rail on desktop, bottom panel on mobile): last 20 events with timestamps — new order, payment captured, status change, review, custom inquiry, low-stock alert. Each row deep-links to the relevant entity. Refreshes every 30 s via React Query polling (or SignalR for real-time later).

### 9.2 Orders `/admin/orders` — full order tracking

This is the **operational nerve centre** of the admin panel. Built for one-handed mobile use (so packing-table staff can update status from a phone) and equally for desktop bulk operations.

#### 9.2.1 List view

**Toolbar (sticky):**

- Search by order #, customer name, phone, email, tracking #.
- Status filter chips (multi-select): **Placed · Confirmed · Crafting · Packed · Shipped · Out for Delivery · Delivered · Cancelled · Return Requested · Returned · Refunded · On Hold**. Each chip shows a live count badge.
- Date range picker (Today · 7d · 30d · custom).
- Payment filter: All · Paid · COD · Refund Pending · Failed.
- Channel filter: Web · WhatsApp inquiry · Custom order.
- Sort: newest · oldest · highest value · ETA soonest.
- **Bulk actions** (appear after row select): Mark Confirmed, Mark Packed, Mark Shipped (prompts for tracking #), Print packing slips, Print invoices, Export CSV.

**Row layout (desktop table):**

```
☐  #TSA-2026-00487  · Priya S.    Mumbai     ₹4,200   🟡 Crafting     ETA 14 May    [···]
☐  #TSA-2026-00486  · Rajesh K.   Bangalore  ₹6,800   🟣 Packed       Tracking ✓     [···]
☐  #TSA-2026-00485  · Ananya R.   Hyderabad  ₹2,400   🟢 Delivered    8 May          [···]
```

Row hover reveals quick actions: View · Advance Status · WhatsApp Customer · Print.

**Mobile card layout:**

```
┌────────────────────────────────────────────┐
│ #TSA-2026-00487       ₹4,200    🟡 Crafting│
│ Priya Sharma · Mumbai                       │
│ Placed 8 May · ETA 14 May                   │
│ Items: Dot Mandala 12" + Resin Coasters     │
│ [ Advance → Packed ]  [ ··· ]               │
└────────────────────────────────────────────┘
```

The primary CTA on each mobile card is the **next-status button** — one tap advances the workflow. This is the single most-used action for staff.

#### 9.2.2 Detail view `/admin/orders/[id]`

**Header strip:** Order #, placed date, customer name + 📞 + 💬WhatsApp + ✉️ inline, total, payment badge, current status pill, **Print invoice** / **Print packing slip** buttons.

**Tabs (or stacked sections on mobile):**

1. **Overview**
   - Items list with thumbnails, qty, unit price, total.
   - Shipping address with edit + Google Maps preview.
   - Billing address + GSTIN (if B2B).
   - Payment: method, transaction ID, captured-at, **Refund** button (partial / full).
   - Coupon applied (with code + value).
   - Customer notes (from checkout).
   - Internal notes (admin-only, free-form, timestamped per author).

2. **Status & Tracking** — *the heart of order management*
   - Interactive status timeline. Each step is a **tappable chip** that opens a confirm sheet:
     ```
     Move to: Packed
     ┌────────────────────────────────────┐
     │ Internal note (optional):           │
     │ [                                  ]│
     │                                     │
     │ ☑ Notify customer via WhatsApp     │
     │ ☑ Send email update                │
     │                                     │
     │ [ Cancel ]   [ Confirm Move ]      │
     └────────────────────────────────────┘
     ```
   - Tracking section: courier dropdown (Delhivery, Bluedart, India Post, Shiprocket, Other), **tracking number input**, "Get live status" button (calls courier API if integrated → otherwise opens the courier's tracker in a new tab).
   - ETA editor (admin can adjust if crafting takes longer; customer sees the update).
   - **Customer's view preview** — toggle that renders exactly what the customer sees in `/account/orders/[id]`. Eliminates "admin sees X, customer sees Y" support tickets.

3. **Activity log**
   - Immutable event stream from the `orderEvents` table — every status change, note, refund, message sent, with `by` (user/admin/system) and timestamp.
   - Filter: All · Status changes · Notes · Messages · Refunds.

4. **Messages**
   - Inline WhatsApp + email thread with the customer (via WhatsApp Cloud API + transactional email logs).
   - Pre-filled templates: *"Hi {name}, your order has been packed and will ship tomorrow…"* — admin can edit before sending.

5. **Issues / Returns** (visible if any)
   - Photos uploaded by customer, reason, requested action, admin response form, refund / replacement decision tree.

#### 9.2.3 Status workflow (canonical — shared with §7.9.9)

```
PLACED
   │  payment captured  /  COD verified
   ▼
CONFIRMED ────────────► ON_HOLD (with reason)
   │                       │
   ▼                       ▼ (resume)
CRAFTING ◄────────────────┘
   │  artwork ready
   ▼
PACKED
   │  handed to courier
   ▼
SHIPPED  (tracking # required to enter)
   │
   ▼
OUT_FOR_DELIVERY  (auto-pulled from courier webhook if integrated)
   │
   ▼
DELIVERED
   │  within 7 days
   ▼
RETURN_REQUESTED → RETURNED → REFUNDED

(CANCELLED is allowed from PLACED / CONFIRMED / CRAFTING with reason)
```

**Guardrails:**

- Cannot skip statuses except: *anything → Cancelled* (with reason), *anything → On Hold* (with reason).
- Moving to SHIPPED requires tracking number.
- Moving to REFUNDED auto-creates a refund record + triggers payment gateway refund API.
- Every transition writes to `orderEvents` — never overwrite.
- Customer notifications fire automatically based on transition (configurable per-template in §9.14).

#### 9.2.4 Notifications fired on each status change

| Transition | Customer channels | Internal |
|---|---|---|
| → CONFIRMED | WhatsApp + email | – |
| → CRAFTING | WhatsApp ("Our artist has started your piece") | – |
| → PACKED | – (silent, internal milestone) | Slack/email to fulfilment lead |
| → SHIPPED | WhatsApp + email with tracking # & link | – |
| → OUT_FOR_DELIVERY | WhatsApp + push | – |
| → DELIVERED | WhatsApp ("Hope you love it 💛") + review-request scheduled +72h | – |
| → CANCELLED | WhatsApp + email with reason + refund ETA | – |
| → ON_HOLD | WhatsApp with reason | – |
| → REFUNDED | WhatsApp + email with refund txn # | – |

Templates editable in `/admin/settings/notifications` (§9.14).

#### 9.2.5 Bulk operations

- **Bulk advance status** — select rows in the same status → advance all.
- **Bulk WhatsApp** — send a templated message to all selected customers (e.g. delay notice).
- **Bulk print** — packing slips and invoices in a single PDF, ordered by destination pincode.
- **CSV export** — for accounting, GST filing.

#### 9.2.6 Backend contract

```ts
// already exists in backend/src/functions/orderAdmin.ts — extend to:

GET   /api/admin/orders                 // ?status=&from=&to=&q=&page=
GET   /api/admin/orders/:id
PATCH /api/admin/orders/:id/status      // body: { to, note?, notifyCustomer?, tracking? }
POST  /api/admin/orders/:id/notes       // internal note
POST  /api/admin/orders/:id/refund      // body: { amount, reason }
POST  /api/admin/orders/:id/message     // send WhatsApp/email
GET   /api/admin/orders/:id/events      // activity log

// New table:  orderEvents
//   pk: orderId, rk: ISO-timestamp + sortable id
//   fields: from, to, by, byRole, note, channel, meta(json)
```

The customer-facing `/account/orders/[id]` (§7.9.3) reads the same `orderEvents` so admin and customer always see one consistent truth.

### 9.3 Products `/admin/products`

- Replace the current `/admin/gallery` route.
- Table/card list with image, title, category, price, stock, status toggle.
- Bulk: archive, change category, change price (%).
- New/Edit form:
  - Multi-image upload (drag-reorder, set primary)
  - Title, slug (auto)
  - Category, tags
  - Price, compare-at price
  - Size, material, weight
  - Description (rich text)
  - Care instructions
  - SEO meta
  - Inventory (qty or "made-to-order")
  - Flags: featured, new, bestseller, sale
- Live preview pane on desktop.

### 9.4 Inventory `/admin/inventory`

- Stock-only view. Low-stock alerts. Quick stock adjust.
- "Made-to-order" lead-time field per product.

### 9.5 Categories `/admin/categories`

CRUD with image, description, SEO. Drag-reorder.

### 9.6 Collections `/admin/collections`

Curated bundles (e.g. "Diwali Picks", "Housewarming Gifts"). Select multiple products, add hero image + description. Surfaces at `/collections/[slug]`.

### 9.7 Customers `/admin/customers`

List with search, order count, lifetime value. Detail view shows order history, addresses, notes, "Tag VIP", export.

### 9.8 Custom Orders `/admin/custom-orders`

Inbox-style queue for `/custom-order` submissions. Kanban columns: New · Quoted · Approved · In Progress · Completed. Reply via WhatsApp / email from inside the panel.

### 9.9 Reviews `/admin/reviews`

Moderation: approve / hide / reply. Filter by rating, art form.

### 9.10 Coupons `/admin/coupons`

Full CRUD over the coupon types defined in §8.1. Each form supports: code (auto-format uppercase), type, value, min spend, max discount cap, valid from/to, usage limit (total + per-user), applicable categories/products, excluded products, stackable toggle, first-time-only toggle, **"Promote in announcement bar"** toggle (auto-links to §9.15). Detail page shows real-time redemption stats and a "Test this code" simulator.

### 9.11 Media `/admin/media`

Blob-storage browser. Folders by category. Search, bulk-delete, copy URL. Used across product/collection/content editors.

### 9.12 Content `/admin/content`

Markdown editor for static pages (FAQ, About, Shipping, etc.). Versioning + draft/publish.

### 9.13 Analytics `/admin/analytics`

- Sales: revenue, orders, AOV, conversion rate, returning vs new.
- Products: top sellers, slow movers, view-to-purchase ratio.
- Customers: cohort retention, top buyers.
- Traffic: source breakdown (if GA4 wired up).

### 9.14 Settings `/admin/settings/*`

- **General:** store name, contact, currency, time zone, social links.
- **Shipping:** zones, rates, free-ship threshold, courier integrations (Delhivery / Shiprocket API keys, webhook URLs).
- **Payments:** Razorpay keys, COD on/off, refund policy text.
- **Staff:** invite admins with roles (owner · manager · support · read-only). Audit log per staff.
- **Notifications:** per-status WhatsApp + email + push templates (Handlebars-style `{{customerName}}`, `{{orderId}}`, `{{trackingUrl}}`) with live preview and "send test to my number".

### 9.15 Announcement Bar `/admin/settings/announcement`

CRUD for marquee banner items defined in §6. Fields per item: `message`, `link`, `startDate`, `endDate`, `priority`, `theme` (gold / festive-pink / muted), `active`. Drag-reorder list. "Preview on site" opens a live iframe. **One-tap link** to attach a coupon code from §9.10 — keeps banner copy and the actual discount aligned automatically.

---

## 10. Component System

Build once, reuse everywhere. Folder: `frontend/components/ui/`.

| Component | Variants | Notes |
|---|---|---|
| `Button` | `primary` (gold), `outline`, `ghost`, `danger` · sizes `sm/md/lg` | All ≥ 44 px touch target |
| `Input` / `Textarea` / `Select` | with `label`, `error`, `hint`, `icon` | Floating-label style |
| `Sheet` (bottom drawer) | filter, sort, share | `react-modal-sheet` or framer-motion |
| `Dialog` | confirm, info | `radix-ui/react-dialog` |
| `Tabs` | underline, pill | radix |
| `Accordion` | for FAQ, checkout, mobile product info | radix |
| `Carousel` | snap, autoplay-optional | `embla-carousel-react` |
| `Toast` | success, error, info | `sonner` |
| `Badge` | new, bestseller, sale, sold-out | matches existing tokens |
| `Skeleton` | text, image, card | shimmer animation |
| `EmptyState` | with illustration + CTA | |
| `PriceTag` | with strikethrough + discount % | gold foil shimmer |
| `ProductCard` | mobile card + horizontal-scroll variant | extend existing |
| `ImageGallery` | swipe + pinch zoom | mobile-first |
| `StarRating` | input + display | |
| `QuantityStepper` | – number + | min 44 px |
| `StickyActionBar` | bottom-fixed on mobile | safe-area aware |
| `BottomTabBar` | 5-slot, raised middle | |
| `Header` | scroll-aware translucent | extend existing |
| `Footer` | accordion mobile / columns desktop | |
| `KolamLoader` | full-screen + inline | keep existing |
| `SectionDivider` | gold line | keep existing |

**Animation tokens** (framer-motion variants in `lib/motion.ts`):

```ts
export const fadeUp = { hidden:{opacity:0,y:16}, visible:{opacity:1,y:0,transition:{duration:0.4,ease:[0.32,0.72,0,1]}} }
export const stagger = { visible:{transition:{staggerChildren:0.06}} }
export const scaleIn = { hidden:{opacity:0,scale:0.96}, visible:{opacity:1,scale:1,transition:{duration:0.35}} }
```

---

## 11. State Management & Data Layer

**Client state:**
- **Zustand** stores for `cart`, `wishlist`, `ui` (drawer/sheet open), `auth`.
- Persist `cart` + `wishlist` to `localStorage`, hydrate on mount, sync to API when logged in.

**Server state:**
- **TanStack Query (React Query)** for all GET endpoints — automatic caching, refetch, optimistic updates.
- Query key convention: `['products', { category, sort, page }]`.

**Forms:**
- **react-hook-form** + **zod** for validation (single source of truth shared with backend types).

**Auth:**
- JWT in `httpOnly` cookie (move away from localStorage — XSS risk).
- `/api/auth/me` on app boot to hydrate user.
- Middleware-protected routes via `middleware.ts`.

**Backend (already in place — extend):**
- Azure Functions in TypeScript ✓
- Table Storage for products/orders/users ✓
- Blob Storage for images ✓
- **Add:** Azure Communication Services for SMS OTP + transactional email.
- **Add:** Razorpay (preferred for India) for payments.
- **Add:** WhatsApp Cloud API for order updates (vs. wa.me deep links).

---

## 12. Performance, PWA & SEO

**Perf budget (mobile, 4G):**

| Metric | Target |
|---|---|
| LCP | < 2.5 s |
| INP | < 200 ms |
| CLS | < 0.1 |
| TBT | < 200 ms |
| JS shipped | < 180 KB gzipped on first load |

**Techniques:**

- Server Components by default; client only where needed (cart, gallery, forms).
- `next/image` everywhere with explicit `sizes`. Serve AVIF.
- Route-level code splitting (free with App Router).
- Defer framer-motion on routes that don't need it.
- Preload hero image; preconnect to blob CDN.
- `loading="lazy"` on below-fold images.

**PWA:**
- `next-pwa` for service worker, offline shell, install prompt.
- App icons, splash screens, theme color = `#8B3A0E`.
- Cache product images aggressively.

**SEO:**
- Per-page `generateMetadata` with title, description, OG, Twitter card.
- `app/sitemap.ts` dynamic from products/categories.
- `app/robots.ts`.
- **Product JSON-LD** (`schema.org/Product`) with price, availability, reviews.
- **Organization & LocalBusiness JSON-LD** on home.
- Clean canonical URLs.
- Localised meta (en-IN).
- Pre-render category and `/the-craft/*` pages as SSG for crawlability + speed.

---

## 13. Accessibility & i18n

**A11y:**
- Color contrast ≥ 4.5 : 1 (the burnt-orange + white passes; verify gold-on-dark CTAs at WCAG AA).
- Every icon-only button has `aria-label`.
- Focus-visible rings (`focus-visible:ring-2 focus-visible:ring-gold`).
- Skip-to-content link.
- Trap focus inside drawers/modals.
- Test with VoiceOver (iOS) and TalkBack (Android).

**i18n (V2):**
- `next-intl` ready from day one.
- Default `en-IN`. Add `hi-IN` and `te-IN` (Hyderabad audience) later.
- Currency formatter via `Intl.NumberFormat('en-IN', { style:'currency', currency:'INR' })` — already partly using.

---

## 14. Tech Choices & Folder Structure

```
frontend/
├── app/
│   ├── (marketing)/                ← public pages, shared layout
│   │   ├── page.tsx                home
│   │   ├── our-story/page.tsx
│   │   ├── the-craft/
│   │   ├── care-guide/page.tsx
│   │   ├── journal/
│   │   └── reviews/page.tsx
│   ├── (shop)/                     ← shopping pages
│   │   ├── shop/
│   │   ├── product/[id]/page.tsx
│   │   ├── collections/[slug]/page.tsx
│   │   ├── new-arrivals/page.tsx
│   │   ├── best-sellers/page.tsx
│   │   ├── sale/page.tsx
│   │   ├── search/page.tsx
│   │   └── custom-order/page.tsx
│   ├── (account)/account/...
│   ├── (auth)/login,register,forgot-password,verify-otp
│   ├── cart/page.tsx
│   ├── checkout/page.tsx
│   ├── order-confirmation/[id]/page.tsx
│   ├── admin/...                   ← keep current structure, extend
│   ├── api/                        ← Next route handlers if any
│   ├── layout.tsx
│   ├── not-found.tsx
│   ├── error.tsx
│   ├── loading.tsx
│   ├── sitemap.ts
│   ├── robots.ts
│   └── manifest.ts                 PWA
├── components/
│   ├── ui/                         primitives
│   ├── shop/                       ProductCard, FilterSheet, etc.
│   ├── checkout/
│   ├── account/
│   ├── admin/
│   ├── marketing/                  Hero, ScrollStory, Testimonials
│   ├── Header.tsx
│   ├── Footer.tsx
│   ├── BottomTabBar.tsx            NEW
│   └── KolamLoader.tsx
├── lib/
│   ├── api.ts                      fetch helpers
│   ├── auth.ts
│   ├── motion.ts                   framer-motion variants
│   ├── format.ts                   currency, date
│   ├── seo.ts                      metadata helpers
│   └── analytics.ts                GA4 / Meta Pixel
├── stores/                         zustand
│   ├── cart.ts
│   ├── wishlist.ts
│   ├── ui.ts
│   └── auth.ts
├── hooks/
│   ├── useMediaQuery.ts
│   ├── useScrollDirection.ts
│   ├── useSafeArea.ts
│   └── useHaptic.ts
├── types/index.ts
├── data/                           static seed (categories etc.)
├── public/
│   ├── images/
│   ├── icons/                      PWA icons
│   └── fonts/
├── tailwind.config.js
├── postcss.config.js
├── next.config.js
└── tsconfig.json
```

**Libraries to add:**

```
zustand            client state
@tanstack/react-query  server state
react-hook-form    forms
zod                schema
@radix-ui/react-dialog, accordion, tabs, dropdown-menu, popover
embla-carousel-react   carousels
react-modal-sheet  bottom sheets (or roll your own with framer-motion)
sonner             toasts
next-pwa           PWA
next-intl          i18n (V2)
recharts           admin charts
react-zoom-pan-pinch   product gallery zoom
date-fns           dates
```

---

## 15. Migration Plan from Current Code

The current code is a solid starting point — don't throw it away.

| Keep as-is | Rework | Build new |
|---|---|---|
| Brand tokens (Tailwind config) | `Header.tsx` (mobile-first, scroll-aware, sits below marquee) | **MarqueeBanner** (§6) + `BannerProvider` |
| `KolamLoader`, `SectionDivider`, `WhatsAppButton` | `ProductCard` (mobile-first padding, sticky price) | `BottomTabBar` |
| Azure Functions backend skeleton | `app/page.tsx` (mobile-first hero, scroll-story) | All account pages (`/account/*`) incl. order timeline & tracker |
| Auth lib (`lib/auth.ts`) — but move JWT to cookie | `app/gallery/` → `app/shop/` with category sub-routes | **Coupon system** (validate API + checkout UX + admin CRUD) |
| Admin gallery CRUD | `orderAdmin.ts` (extend with `/status`, `/notes`, `/refund`, `/message`, `/events`) | **`orderEvents` table** + admin Orders detail page |
| Checkout shell | Checkout (real Razorpay, accordion mobile UX, coupon row) | Announcement bar admin CRUD + customer/admin order tracking pages |

**Concrete first PR (sample):**
1. Add Zustand `cart` store + wire `ProductCard`'s "Add to Cart".
2. Add `BottomTabBar` component, mount in `ConditionalLayout`.
3. Refactor `Header` to mobile-first (logo center, search left, cart right) and reserve space for the marquee.
4. Add `MarqueeBanner` with hard-coded items first; wire to API in PR 2.
5. Convert `app/page.tsx` hero to mobile-first (no `lg:` overrides driving layout).
6. Rename `/gallery` → `/shop`, add 5 category routes as SSG.

---

## 16. Phased Roadmap

### Phase 1 — Foundation (Weeks 1–2)

- Mobile-first refactor of layout, Header, Hero, ProductCard.
- **Announcement marquee banner** (§6) wired to `/api/announcements` with admin CRUD (§9.15).
- BottomTabBar.
- Cart state (Zustand + persist).
- React Query setup.
- Shop + category pages.
- PWA basics (manifest, icons, install).

### Phase 2 — Commerce + Order Management (Weeks 3–4)

- Real checkout with Razorpay.
- **Coupon validation API + checkout coupon UX** (§8.3).
- JWT cookie auth + register / forgot password / OTP.
- **Customer order management** (§7.9): `/account`, `/account/orders`, `/account/orders/[id]`, `/account/orders/[id]/track`.
- **Admin order management** (§9.2): list, filters, detail view, status timeline editor, tracking input, internal notes, bulk advance.
- `orderEvents` table + shared event log between admin & customer.
- WhatsApp Cloud API + transactional email on status transitions.
- Wishlist.
- Address book.

### Phase 3 — Storytelling & Custom Orders (Week 5)

- `/our-story`, `/the-craft/*`, `/care-guide`.
- `/custom-order` multi-step form + admin inbox.
- Scroll-driven home reveal.
- Reviews submission + display.

### Phase 4 — Admin Expansion (Weeks 6–7)

- Orders panel (replacing gallery-only admin).
- Customers, Inventory, Coupons.
- Media library.
- Analytics with Recharts.
- Settings (shipping, payments, staff).

### Phase 5 — Polish (Week 8)

- Lighthouse to 95+ across the board.
- A11y audit.
- SEO: sitemap, JSON-LD, OG images per product.
- WhatsApp Cloud API for order updates.
- Instagram strip on home.
- Bug bash on iPhone SE, Pixel 5, iPad mini.

### Phase 6 (V2 — optional)

- Multi-language (hi, te).
- Journal/blog.
- Loyalty / referrals.
- AR preview ("see it on your wall").

---

## Appendix A — Sample mobile-first Hero (snippet)

```tsx
<section className="relative min-h-[100svh] flex flex-col justify-end overflow-hidden">
  {/* Full-bleed art video */}
  <video
    src="/media/hero-mandala.mp4"
    autoPlay muted loop playsInline
    className="absolute inset-0 w-full h-full object-cover"
  />
  <div className="absolute inset-0 bg-gradient-to-t from-primary-dark via-primary-dark/60 to-transparent" />

  {/* Copy + CTAs — pinned to lower third on mobile, centered on lg */}
  <div className="relative z-10 px-5 pb-10 pt-24
                  lg:px-12 lg:pb-0 lg:pt-0 lg:flex lg:items-center lg:min-h-[100svh]">
    <div className="max-w-md lg:max-w-xl">
      <p className="text-gold-light/80 text-[11px] tracking-[0.3em] uppercase mb-3">
        Hyderabad · Handcrafted with Love
      </p>
      <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl
                     font-bold text-white leading-[1.05] mb-5">
        Where Tradition <br/>
        Meets <span className="gold-text">Creativity</span>
      </h1>
      <p className="text-white/70 text-base lg:text-lg mb-7 leading-relaxed">
        Bespoke Dot Mandala, Resin and Lippan art — handcrafted to bring beauty into your space.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/shop" className="btn-gold h-12 px-7 text-base">
          Explore the Collection
        </Link>
        <Link href="/custom-order" className="btn-outline h-12 px-7 text-base border-white/30 text-white">
          Talk to Us About a Custom Design
        </Link>
      </div>
    </div>
  </div>
</section>
```

## Appendix B — Sample BottomTabBar (snippet)

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Search, Sparkles, Heart, User } from 'lucide-react'

const tabs = [
  { href: '/',            label: 'Home',     icon: Home     },
  { href: '/shop',        label: 'Shop',     icon: Search   },
  { href: '/custom-order',label: 'Custom',   icon: Sparkles, raised: true },
  { href: '/account/wishlist', label: 'Saved', icon: Heart  },
  { href: '/account',     label: 'Account',  icon: User     },
]

export default function BottomTabBar() {
  const pathname = usePathname()
  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40
                 bg-primary-dark/90 backdrop-blur-xl border-t border-gold/15
                 pb-[env(safe-area-inset-bottom)]"
      aria-label="Primary"
    >
      <ul className="grid grid-cols-5 h-16">
        {tabs.map(({ href, label, icon: Icon, raised }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <li key={href} className="flex">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-1 w-full
                            text-[10px] font-medium transition-colors
                            ${active ? 'text-gold' : 'text-white/60'}
                            ${raised ? '-mt-5' : ''}`}
              >
                <span className={`${raised
                  ? 'w-12 h-12 rounded-full bg-gradient-to-br from-gold to-gold-dark text-primary-dark shadow-lg shadow-gold/30 flex items-center justify-center'
                  : ''}`}>
                  <Icon className={raised ? 'w-5 h-5' : 'w-[18px] h-[18px]'} />
                </span>
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
```

---

**End of blueprint.** Ready to start with Phase 1 PR list on request.
