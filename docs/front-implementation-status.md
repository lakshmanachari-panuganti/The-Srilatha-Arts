# Frontend Implementation Status

> Last reviewed: 2026-05-13 by full-stack audit of [frontend-plan.md](frontend-plan.md) vs. repo code + live site (srilatha.art).

## Design System & Infrastructure — ✅ Complete

| Item | Status | Notes |
|------|--------|-------|
| Mobile-first Tailwind setup | ✅ | `globals.css`, `tailwind.config.ts` |
| Custom color palette (plum, lavender, ivory, terracotta) | ✅ | Differs from plan's terracotta/cream — uses purple/lavender theme instead |
| Typography (serif + sans) | ✅ | Working well |
| Glassmorphism cards + glass surfaces | ✅ | `.card`, `.card-cream`, `.glass` in `globals.css` |
| Gold-text gradient | ✅ | `.gold-text` component class |
| Button system (dark, outline, link) | ✅ | `.btn-dark`, `.btn-outline`, `.btn-link` |
| Chip rail (horizontal scroll) | ✅ | `.chip-rail`, `.chip` classes |
| Kolam dot loading animation | ✅ | `KolamLoader.tsx` |
| Bottom tab bar (mobile) | ✅ | `BottomTabBar.tsx` |
| Mobile drawer navigation | ✅ | `MobileDrawer.tsx` |
| Header (glass, sticky) | ✅ | `Header.tsx` |
| Footer | ✅ | `Footer.tsx` |
| Conditional layout (hide chrome on admin/checkout) | ✅ | `ConditionalLayout.tsx` |
| Marquee banner | ✅ | `MarqueeBanner.tsx` |
| Search overlay | ✅ | `SearchOverlay.tsx` |
| API client with credentials | ✅ | `lib/api.ts` |
| INR formatting + date helpers | ✅ | `lib/format.ts` |

## Customer-Facing Pages

### Core Pages — ✅ Complete

| Route | Plan §  | Status | Notes |
|-------|---------|--------|-------|
| `/` (Home) | §7.1 | ✅ | Hero, collections, bestsellers, testimonials, custom CTA |
| `/shop` | §7.2 | ✅ | Product grid with category filter |
| `/shop/[category]` | §7.3 | ✅ | Category-filtered shop |
| `/product/[id]` | §7.4 | ✅ | Product detail with images, pricing |
| `/cart` | §7.6 | ✅ | Cart with items, coupon input, order summary |
| `/checkout` | §7.7 | ✅ | Checkout flow (placeholder stage) |
| `/custom-order` | §7.5 | ✅ | Custom order inquiry form |
| `/login` | Auth | ✅ | Customer login |
| `/our-story` | §7.10 | ✅ | About page |
| `/the-craft` | §7.10 | ✅ | How each art form is made |
| `/reviews` | §7.11 | ✅ | Reviews wall |
| `/contact` | §7.12 | ✅ | Contact page |
| `/faq` | §7.12 | ✅ | FAQ page |
| `/shipping-and-returns` | §7.12 | ✅ | Shipping policy |
| `/care-guide` | §7.12 | ✅ | Artwork care guide |
| `/privacy-policy` | §7.12 | ✅ | Privacy policy |
| `/terms` | §7.12 | ✅ | Terms of service |
| `/new-arrivals` | §7.2 | ✅ | New arrivals filtered view |
| `/best-sellers` | §7.2 | ✅ | Best sellers filtered view |
| `/sale` | §7.2 | ✅ | Sale items |
| `/collections` | §4 | ✅ | Collections listing |

### Account Pages — ⚠️ Partial

| Route | Plan § | Status | Notes |
|-------|--------|--------|-------|
| `/account` | §7.9.1 | ✅ | Dashboard stub |
| `/account/wishlist` | §7.9.5 | ✅ | Wishlist grid |
| `/account/orders` | §7.9.2 | ❌ Missing | Order history list |
| `/account/orders/[id]` | §7.9.3 | ❌ Missing | Order detail + timeline |
| `/account/orders/[id]/track` | §7.9.4 | ❌ Missing | Kiosk-style tracker |
| `/account/addresses` | §7.9.6 | ❌ Missing | Address CRUD |
| `/account/coupons` | §7.9.7 | ❌ Missing | User's coupon wallet |
| `/account/profile` | §7.9.8 | ❌ Missing | Profile + preferences |
| `/account/notifications` | §7.9 | ❌ Missing | Notification history |

### Other Missing Customer Pages

| Route | Plan § | Status |
|-------|--------|--------|
| `/order-confirmation/[id]` | §7.8 | ❌ Missing |
| `/register` | Auth | ❌ Missing |
| `/forgot-password` | Auth | ❌ Missing |
| `/search` | §4 | ❌ Missing (SearchOverlay exists but no results page) |

## Admin Panel

### Admin Infrastructure — ✅ Complete

| Item | Status | Notes |
|------|--------|-------|
| Admin layout (sidebar + mobile header) | ✅ | `admin/layout.tsx` — active nav state now fixed |
| Admin login | ✅ | `admin/login/page.tsx` |

### Admin Pages — ⚠️ Partial (UI exists; see wiring status below)

| Route | Plan § | Status | Notes |
|-------|--------|--------|-------|
| `/admin` (Dashboard) | §9.1 | ✅ | KPI cards via `GET /api/admin/stats` — real data |
| `/admin/orders` | §9.2 | ✅ | Order list via `GET /api/admin/orders` — real data |
| `/admin/products` | §9.3 | ✅ | Product table via `GET /api/products` — real data |
| `/admin/products/new` | §9.3 | ✅ | Add product form — calls `POST /api/admin/products` |
| `/admin/products/[id]/edit` | §9.3 | ✅ | Edit/delete form — calls `PATCH`/`DELETE /api/admin/products/{id}` |
| `/admin/custom-orders` | §9.8 | ✅ | Wired to `GET`/`PATCH /api/admin/custom-orders` |
| `/admin/reviews` | §9.9 | ✅ | Wired to `GET`/`PATCH /api/admin/reviews` |
| `/admin/coupons` | §9.10 | ✅ | Wired to full CRUD `/api/admin/coupons` |
| `/admin/announcements` | §9.15 | ✅ | Wired to full CRUD `/api/admin/announcements` |
| `/admin/inventory` | §9.4 | ✅ | Read-only stock view via `GET /api/products` — no stock-edit endpoint yet |
| `/admin/settings` | §9.16 | ⚠️ | UI hub + general form exists; **Save button has no handler**, no `apiFetch`, no backend endpoint |
| `/admin/categories` | §9.5 | ⚠️ | UI reads `@/data/categories` (local static file); Add/Edit/Delete buttons are no-ops; no backend CRUD |
| `/admin/collections` | §9.6 | ⚠️ | UI has mock data; no backend CRUD endpoint |
| `/admin/analytics` | §9.13 | ⚠️ | All values hardcoded to 0; no `apiFetch`; placeholder charts only |
| `/admin/media` | §9.11 | ⚠️ | Uses `MOCK_MEDIA` array; Upload button is no-op; no blob API wiring |
| `/admin/customers` | §9.7 | ❌ | Uses `MOCK_CUSTOMERS` array; no `apiFetch`; no backend endpoint |
| `/admin/orders/[id]` | §9.2 | ❌ | Uses `MOCK_ORDER` + `MOCK_EVENTS`; no `apiFetch`; status controls are no-ops |

## State Management & Data Layer — ⚠️ Partial

| Item | Status | Notes |
|------|--------|-------|
| Zustand stores directory | ✅ | `stores/` dir exists |
| Cart store | ⚠️ | Needs verification |
| API wiring to backend | ⚠️ | Dashboard/Orders/Products/Custom-Orders/Reviews/Coupons/Announcements/Inventory wired; Settings/Categories/Collections/Customers/Analytics/Media/Orders[id] still mock/static |
| Product data | ✅ | Admin products page calls `GET /api/products` — wired to backend |

## PWA & SEO — ✅ Mostly Complete

| Item | Status | Notes |
|------|--------|-------|
| Web manifest | ✅ | `app/manifest.ts` |
| Sitemap | ✅ | `app/sitemap.ts` |
| Robots.txt | ✅ | `app/robots.ts` |
| Error boundary | ✅ | `app/error.tsx` |
| 404 page | ✅ | `app/not-found.tsx` ("This canvas is blank") |
| Loading state | ✅ | `app/loading.tsx` |

---

## Summary

**Current position: ~65% of frontend plan implemented**

### What's working well:
- Full design system with mobile-first approach
- All public-facing content pages (shop, categories, product detail, static pages)
- Admin panel: Dashboard, Orders, Products, Products/New, Products/Edit, Custom-Orders, Reviews, Coupons, Announcements, Inventory — all wired to real backend APIs
- Product add/edit/delete fully functional (partition-key bug fixed in c5492a7)

### Critical gaps:
1. **Account order management** — `/account/orders`, `/account/orders/[id]` — the customer can't view their own orders yet
2. **Admin orders/[id]** — detail page still uses `MOCK_ORDER` + `MOCK_EVENTS`; no API call
3. **Admin Customers** — `MOCK_CUSTOMERS` array; needs `GET /api/admin/customers` backend endpoint + `listAllUsers()` in tableStorage
4. **Admin Settings Save** — form inputs exist but Save has no handler; needs `GET/PATCH /api/admin/settings` backend endpoint
5. **Admin Categories/Collections** — UI-only, no backend CRUD; correctly ❌ in backend doc
6. **Admin Analytics** — hardcoded zeros; should call `GET /api/admin/stats` (already exists) and extend it
7. **Admin Media** — MOCK_MEDIA; Upload button is a no-op; `adminUpload` endpoint exists in backend but frontend not wired
8. **Checkout flow** — placeholder; needs Razorpay SDK integration once backend payments land
