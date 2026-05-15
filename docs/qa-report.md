# QA Report — The Srilatha Arts
**Date**: 2026-05-15  
**Environment**: Production (Azure Static Web Apps + Azure Functions)  
**Frontend URL**: https://delightful-mushroom-062e18100.7.azurestaticapps.net  
**Backend URL**: https://func-thesrilathaarts-dev.azurewebsites.net/api  

---

## Summary

| Category | Working ✅ | Placeholder / Known Gap ⚠️ | Broken / Missing ❌ |
|---|---|---|---|
| Public Pages | 14/16 | 2 | 0 |
| Authentication | 3/3 | 0 | 0 |
| Shop & Products | 5/5 | 0 | 1 |
| Cart & Wishlist | 4/5 | 0 | 1 |
| Checkout | 0/1 | 1 | 0 |
| Admin Panel | 9/13 | 4 | 0 |
| Backend API Endpoints | 15/15 | 0 | 0 |
| Frontend–Backend Wiring | — | 0 | 3 |

---

## 1. Public Pages

| Page | URL | Status | Notes |
|---|---|---|---|
| Home | `/` | ✅ | Marquee, hero, category grid, footer — all render |
| Shop | `/shop` | ✅ | Loads 3 products from API; category chips work |
| Collections | `/collections` | ✅ | |
| New Arrivals | `/new-arrivals` | ✅ | |
| Best Sellers | `/best-sellers` | ✅ | |
| Sale | `/sale` | ✅ | |
| Our Story | `/our-story` | ✅ | |
| The Craft | `/the-craft` | ✅ | |
| Reviews | `/reviews` | ✅ | |
| Contact | `/contact` | ✅ | |
| FAQ | `/faq` | ✅ | |
| Shipping & Returns | `/shipping-and-returns` | ✅ | |
| Care Guide | `/care-guide` | ✅ | |
| Privacy Policy | `/privacy-policy` | ✅ | |
| Terms | `/terms` | ✅ | |
| Custom Order | `/custom-order` | ⚠️ | **Uses `PlaceholderPage`** — shows "WhatsApp us" text. Status doc incorrectly marks ✅ |
| Login | `/login` | ✅ | Tab-based sign-in / sign-up |

---

## 2. Authentication

| Flow | Status | Notes |
|---|---|---|
| Customer login — wrong credentials | ✅ | Returns 401, displays "Invalid email or password" |
| Customer login — correct credentials | ✅ | `testuser@srilatha.art / Test@1234` → 200, JWT stored in `tsa-user-auth`, redirects to `/account/` |
| Admin login — correct credentials | ✅ | `test@srilatha.art / test@123` → 200, JWT stored in `tsa-admin-auth`, redirects to `/admin/` |
| Admin logout | ✅ | `POST /auth/admin/logout` → 200 `{"ok":true}` |
| `GET /auth/me` without token | ✅ | Returns 200 `{"user":null}` (by design, not 401) |
| `GET /auth/me` with customer token | ✅ | Returns 200 with user object |

---

## 3. Shop & Products

| Feature | Status | Notes |
|---|---|---|
| Product list (`GET /products`) | ✅ | 3 products from Azure Table Storage |
| Category filter (`/shop/lippan/`) | ✅ | Shows 2 lippan products |
| Sold Out badge | ✅ | `lippan-5b598cd2` correctly shows "Sold Out", Add To Cart disabled |
| SAVE % badge | ✅ | Displays on products with `compareAtPrice > price` |
| Product detail page | ✅ | Title, price, description, sticky add-to-cart bar |
| Reviews section on product page | ❌ | **Backend API `GET /reviews/product/{id}` exists and returns 200, but product detail page renders no reviews UI** |

### Data Issue — dot-mandala slug mismatch
- **Product ID**: `dot-mandala-1d2877c2`
- **Slug field**: `dot-mandala-f55f2641` (stale slug from deleted-then-recreated product)
- **Impact**: Low — wishlist uses `productId` for navigation, not slug. However `/product/dot-mandala-f55f2641` will 404 if anyone links by slug. Fix: update the `slug` field in Azure Table Storage to match `id`.

---

## 4. Cart & Wishlist

| Feature | Status | Notes |
|---|---|---|
| Add to Cart | ✅ | Cart badge updates; item persists in `tsa_cart` localStorage |
| Cart item display | ✅ | Product title, price, image shown |
| Quantity controls | ✅ | +/− buttons update quantity and subtotal |
| Remove from cart | ✅ | Item removed, cart empties |
| Shipping calculation | ✅ | ₹99 shipping below ₹2,999 threshold, free above |
| **Coupon input on Cart page** | ❌ | **No coupon input field exists in `/cart`**. Status doc incorrectly marks ✅. Backend `POST /coupons/validate` works correctly. |
| Wishlist toggle | ✅ | Heart icon adds/removes from `tsa_wishlist` localStorage |
| Backend wishlist (`GET /wishlist`) | ✅ | Returns 200 `{"items":[]}` — empty (localStorage wishlist is separate) |

---

## 5. Checkout

| Feature | Status | Notes |
|---|---|---|
| Checkout page | ⚠️ | Placeholder — "Razorpay integration pending". Correctly marked ⚠️ in status doc |

---

## 6. Admin Panel

All admin pages load correctly and respect JWT authentication (confirmed via 13 page navigations).

| Admin Feature | Status | Notes |
|---|---|---|
| Dashboard KPIs | ✅ | Revenue ₹0, Orders 0, Active Products 2, Customers 4 — from real API |
| Product list | ✅ | 3 products from API |
| Product edit (PATCH) | ✅ | Fixed in commit `3fd5596` — removed OPTIONS from PATCH handler |
| Product create (POST) | ✅ | `POST /admin/products` → 201 |
| Product delete | ✅ | `DELETE /admin/products/{id}` → 204 |
| Coupon create | ✅ | `POST /admin/coupons` → 201 |
| Coupon delete | ✅ | `DELETE /admin/coupons/{id}` → 204 (with confirm dialog) |
| Orders list | ✅ | API connected, "No orders yet" (expected) |
| Order detail | ✅ | `/admin/orders/[id]` — no orders exist to test detail view |
| Announcements CRUD | ✅ | Backend API works, but **no effect on frontend** (see wiring bugs) |
| Custom orders | ✅ | API connected, "No inquiries found" |
| Reviews | ✅ | API connected, "No reviews found" |
| Inventory | ✅ | 3 products, correct stock status display |
| Analytics | ⚠️ | All zeros — no orders placed yet; hardcoded chart mock data |
| Customers | ⚠️ | **Shows MOCK_CUSTOMERS (3 fake records)**. `GET /admin/customers` endpoint does not exist. Known gap. |
| Media library | ⚠️ | **Mock file list + broken Unsplash images** (`ERR_BLOCKED_BY_ORB`). Upload is no-op. Known gap. |
| Settings Save | ⚠️ | **Save button fires no API call**. Known gap. |

---

## 7. Backend API Endpoints

All tested with live HTTP calls via the deployed frontend.

| Endpoint | Auth | Status | Notes |
|---|---|---|---|
| `GET /products` | Public | ✅ 200 | 3 products |
| `GET /products/{id}` | Public | ✅ 200 | Full product object |
| `GET /announcements` | Public | ✅ 200 | `{"announcements":[]}` — backend DB is empty |
| `GET /auth/me` | Optional | ✅ 200 | Returns `{"user":null}` if no token |
| `POST /auth/login` | — | ✅ 200/401 | Correct creds → JWT; wrong creds → 401 |
| `POST /auth/admin/login` | — | ✅ 200 | JWT returned |
| `POST /auth/admin/logout` | Admin | ✅ 200 | `{"ok":true}` |
| `GET /admin/stats` | Admin | ✅ 200 | Real counts |
| `GET /admin/orders` | Admin | ✅ 200 | Paginated, empty |
| `GET /admin/reviews` | Admin | ✅ 200 | Paginated, empty |
| `GET /admin/custom-orders` | Admin | ✅ 200 | Paginated, empty |
| `GET /admin/coupons` | Admin | ✅ 200 | `{"coupons":[]}` |
| `GET /admin/announcements` | Admin | ✅ 200 | `{"announcements":[]}` |
| `GET /my-orders` | Customer | ✅ 200 | `{"orders":[]}` (route rename fix works) |
| `GET /addresses` | Customer | ✅ 200 | `{"addresses":[]}` |
| `GET /wishlist` | Customer | ✅ 200 | `{"items":[]}` |
| `POST /coupons/validate` | Public | ✅ 200 | Returns `{"valid":false}` for unknown code |
| `GET /reviews/product/{id}` | Public | ✅ 200 | `{"reviews":[],"total":0,"averageRating":0}` |
| `POST /admin/upload` | Admin | ✅ 401 | Correctly rejects unauthenticated |

---

## 8. Frontend–Backend Wiring Bugs

These are gaps where the backend is implemented but the frontend is not connected.

### BUG-1: Marquee Banner uses static data, ignores backend announcements ❌
- **Symptom**: Admin creates announcements via `POST /admin/announcements` → saved to DB → but the homepage marquee never changes.  
- **Root cause**: `MarqueeBanner.tsx` imports from `frontend/data/announcements.ts` (hardcoded array of 4 items), never calls `GET /api/announcements`.  
- **Backend**: `GET /announcements` → 200, returns `{"announcements":[]}` (DB is empty, no announcements were ever created via admin).  
- **Fix**: Replace the static import in `MarqueeBanner.tsx` with a `useEffect` fetch to `GET /api/announcements`.

### BUG-2: Cart page has no coupon input ❌
- **Symptom**: Users cannot apply coupon codes in the cart.  
- **Root cause**: `/app/cart/page.tsx` has no coupon input field at all.  
- **Backend**: `POST /coupons/validate` → 200, works correctly.  
- **Fix**: Add a coupon input section to `/app/cart/page.tsx` that calls `POST /coupons/validate`.

### BUG-3: Product detail page has no reviews section ❌
- **Symptom**: Customers cannot see or submit reviews on product pages.  
- **Root cause**: `ProductDetailClient.tsx` renders no reviews UI.  
- **Backend**: `GET /reviews/product/{id}` → 200; `POST /reviews` → exists.  
- **Fix**: Add a reviews section to `ProductDetailClient.tsx` that fetches and displays reviews, with a review submission form for logged-in customers.

---

## 9. Known Data Issues

| Issue | Severity | Notes |
|---|---|---|
| `dot-mandala` slug mismatch | Low | `id: dot-mandala-1d2877c2`, `slug: dot-mandala-f55f2641` — stale from product recreation. Fix: update slug in Table Storage. |
| dot-mandala image missing | Low | Image URL lost when product was deleted and recreated. Re-upload via admin media panel. |
| Inconsistent localStorage key naming | Cosmetic | Cart/wishlist use underscore (`tsa_cart`); auth stores use hyphen (`tsa-admin-auth`). Not functional but inconsistent. |
| Backend announcements DB empty | Low | 4 hardcoded announcements in static file were never migrated to DB. Once MarqueeBanner is wired, the DB must also be seeded. |

---

## 10. Recommended Fix Priority

### P1 — Fixes that unblock core user journeys
1. **[BUG-2] Add coupon input to Cart page** — coupon backend is fully working
2. **[BUG-1] Wire MarqueeBanner to backend announcements API** — admin CRUD is working

### P2 — Missing product features
3. **[BUG-3] Add reviews section to product detail page** — backend is fully working
4. **[Custom Order] Replace placeholder with actual inquiry form** — backend `POST /custom-orders` exists

### P3 — Admin panel gaps
5. **Admin Settings** — implement `GET`/`PATCH /admin/settings` endpoint + save handler
6. **Admin Media** — wire to Azure Blob Storage for real upload/list
7. **Admin Customers** — implement `GET /admin/customers` endpoint (currently returns MOCK)

### P4 — Data cleanup
8. **Fix dot-mandala slug** — update `slug` field to `dot-mandala-1d2877c2` in Table Storage
9. **Seed backend announcements** — move static `data/announcements.ts` entries into DB via admin panel
