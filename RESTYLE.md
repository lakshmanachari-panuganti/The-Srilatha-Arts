# RESTYLE.md - Srilatha Art frontend reskin brief

> **For: Claude Code (VS Code extension), working on branch `develop`.**
> **Goal:** Transform the entire site's look - warm, premium, gallery-grade,
> photography-forward - for **mobile-first** *and* desktop, **without breaking
> any wiring** (frontend↔backend contract, auth, CSRF, routing, stores, tests).
>
> Read this whole file before writing code. Work in the phases at the bottom,
> in order. Commit after each phase. Do not skip Phase 1.

---

## 0. Golden rules (read first)

1. **This is a presentational change only.** You may edit CSS, Tailwind config,
   and component **markup/className**. You may NOT change data flow, props that
   carry data, API calls, state, or routing.
2. **Never rename an existing Tailwind color token.** Names like `plum`,
   `ivory`, `lavender`, `cream`, `ink` are used at ~200 call sites. Renaming
   ripples everywhere and breaks the build. We change their **values**, not
   their **names** (see §3).
3. **Phase 1 produces zero visual change.** It is a pure refactor that
   centralizes colors. Verify the site looks identical before moving on.
4. After every phase: `cd frontend && npm run build` must pass, and
   `npx playwright test` from the repo root must stay green.

### Do NOT touch these files/dirs (the wiring)
```
backend/**                         ← entire Azure Functions API. Out of scope.
frontend/lib/api.ts                ← single fetch client (CSRF + token routing)
frontend/stores/**                 ← Zustand stores (cart, auth, wishlist…)
frontend/lib/pendingIntent.ts
frontend/lib/site-config.ts        ← unless only editing copy strings
frontend/**/__tests__/**           ← except updating a literal color assertion
e2e/**                             ← except updating a literal color assertion
infra/**, .github/workflows/**
next.config.mjs, staticwebapp.config.json
```
If a visual change *seems* to require editing one of these, stop and flag it
instead.

---

## 1. Backend review (summary - for context only, do not modify)

The backend is solid and **entirely out of scope** for this work. Noted so you
understand the contract you must not disturb:

- **Runtime:** Azure Functions (TypeScript v4 model), one file per route group
  in `backend/src/functions/*.ts`; data in Azure Table Storage.
- **Auth:** JWT with two scopes (customer + admin). The frontend mirror of this
  is `setApiAuthToken(token, scope)` in `lib/api.ts` and the `adminGuard` /
  `userGuard` middleware server-side. Path-based token routing
  (`/admin/*`, `/auth/admin/*` → admin token) is covered by
  `__tests__/api-token-routing.test.ts`.
- **CSRF:** double-submit cookie (`tsa_csrf` + `X-CSRF-Token`) on mutating
  methods. Cross-site (SWA ↔ Function App), so `SameSite=None`.
- **Payments:** Razorpay (`services/razorpay.ts`, `functions/payments.ts`).
- **Other services:** rate limiting, order state machine, blob/queue storage,
  shipping config, an AI content generator for product copy.

**Restyle impact on backend: none.** No endpoint shapes, env vars, or headers
change. The only frontend files that talk to the backend (`lib/api.ts`,
`stores/*`) contain no styling, so leaving them untouched guarantees the wiring
holds.

---

## 2. The new aesthetic

**Concept:** an artisan studio gallery, not a SaaS app. The artwork (resin,
Lippan mirror-work, Kolam, dot mandalas, wedding decor) is the most colourful,
valuable thing on every screen. **The UI must recede so the photography sings.**

Direction:
- Warm **ivory / sand** ground instead of the current lavender-purple gradients.
- **Espresso ink** for headlines, body, and primary buttons - timeless, lets
  colour photography pop.
- **One** restrained metallic accent: **gold/ochre** (ties to gold leaf in resin
  & Lippan, and revives the intended `.gold-text` highlight).
- **Kill the generic-AI tells:** purple body gradients, purple gradient buttons,
  glow shadows, heavy glassmorphism, the always-on float/rotate animations.
- Photography carries the colour; chrome is warm-neutral + gold.

> Why move off purple-on-white at all: it's the single most common
> "AI-generated site" signature, and a vivid purple chrome actively competes
> with multicoloured folk art. Neutral + gold reads as premium craft.

---

## 3. Token centralization (Phase 1 - NON-BREAKING)

The problem today: token **names lie** after the old cream→lavender pivot
(`ivory` is `#2A1056` deep-violet; `plum` is `#EDE9FE` light-lavender), and ~21
raw hex values are hardcoded across 11 component files **and** inside
`globals.css` component classes. You can't retheme that reliably.

The fix is a **two-layer system**: honest CSS variables are the single source of
truth; the existing (misleadingly named) Tailwind tokens are kept as **aliases**
that point at those variables. Call sites keep working untouched.

### 3a. Add the honest variable layer to `app/globals.css`
Inside `@layer base { :root { … } }`, **replace** the current color custom
properties with this. **Phase 1: set the values to the CURRENT colours** (the
RHS below in comments) so nothing changes visually yet. The new-palette values
come in Phase 2.

```css
:root {
  /* ── SEMANTIC SOURCE OF TRUTH (honest names) ──────────────── */
  /* Phase 1: keep == current values (no visual change).         */
  /* Phase 2: change ONLY this block to retheme the whole site.  */

  --surface:        #EDE9FE;  /* page background        (was --color-plum)   */
  --surface-raised: #FFFFFF;  /* cards / sheets                              */
  --surface-sunken: #DDD6FE;  /* alt sections           (was plum-light)     */

  --text:           #2A1056;  /* headlines + primary    (was ivory)          */
  --text-body:      #3D2F55;  /* body copy              (was ivory-soft)     */
  --text-muted:     #7B6F8A;  /* captions / meta        (was ivory-mute)     */

  --brand:          #7C3AED;  /* primary action / links (was lavender)       */
  --brand-strong:   #5B21B6;  /* hover / pressed                             */
  --accent:         #E879F9;  /* single decorative accent (was lavender-pastel)*/
  --accent-strong:  #A855F7;  /* accent text on light (must pass AA)         */

  --border:         rgba(124,58,237,0.40);  /* hairlines                     */
  --ring:           #E879F9;                /* focus ring                    */

  /* functional colours - NOT themed, keep across reskins */
  --ok:   #1A7F4B;  --danger: #B42318;
  --wa-1: #25D366;  --wa-2: #128C7E;  /* WhatsApp button only */

  --banner-h: 0px; --header-h: 64px; --tab-h: 68px;
}
```

### 3b. Point Tailwind tokens at the variables (`tailwind.config.ts`)
Keep **every existing key**. Change only the values to `var(--…)`:

```ts
colors: {
  // surfaces
  plum:            'var(--surface)',
  'plum-light':    'var(--surface-sunken)',
  'plum-warm':     'var(--surface-sunken)',
  'lavender-light':'var(--surface-raised)',
  'lavender-faint':'var(--surface)',
  cream:           'var(--surface-raised)',
  'cream-deep':    'var(--surface-sunken)',
  paper:           'var(--surface-raised)',
  // brand / accent
  lavender:         'var(--brand)',
  'lavender-soft':  'var(--brand)',
  'lavender-pastel':'var(--accent)',
  'primary-dark':   'var(--brand)',
  'primary-burnt':  'var(--brand-strong)',
  // text (ivory-* AND its ink-* mirrors point at the same vars)
  ivory:        'var(--text)',       ink:        'var(--text)',
  'ivory-soft': 'var(--text-body)',  'ink-soft': 'var(--text-body)',
  'ivory-mute': 'var(--text-muted)', 'ink-mute': 'var(--text-muted)',
  // nav surfaces / glass / overlays → derive from vars (keep keys)
  'nav-surface':       'color-mix(in srgb, var(--brand-strong) 92%, transparent)',
  'nav-surface-heavy': 'color-mix(in srgb, var(--brand-strong) 97%, transparent)',
  'glass-surface': 'color-mix(in srgb, var(--surface) 70%, transparent)',
  'glass-border':  'var(--border)',
  'glass-hover':   'var(--surface-sunken)',
  'overlay-soft':  'color-mix(in srgb, var(--brand) 8%, transparent)',
  'overlay-deep':  'color-mix(in srgb, var(--text) 35%, transparent)',
},
```

### 3c. De-hardcode `globals.css` component classes
Rewrite literal hexes in `.btn-dark`, `.btn-outline`, `.sticker`, `.chip`,
`.rule`, `.card`, the scrollbar, and selection to use the variables. Examples:

```css
.btn-dark   { background: var(--brand); color:#fff; }
.btn-dark:hover { background: var(--brand-strong); }
.btn-outline{ border:1.5px solid var(--border); color:var(--text); }
.sticker    { background: var(--accent); color:#fff; }
.chip.is-active,
.chip[aria-current='page'] { background: var(--brand); color:#fff; border-color:transparent; }
::selection { background: color-mix(in srgb, var(--accent) 25%, transparent); color: var(--text); }
::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--brand) 50%, transparent); }
```

### 3d. Replace hardcoded hexes in components
Find them, swap each for the nearest token class (`bg-*`, `text-*`,
`border-*`) or `var(--…)`:
```
cd frontend && grep -rnE "#[0-9A-Fa-f]{6}" app components
```
Known offenders (~21 values across 11 files) include `#7C3AED`, `#6D28D9`,
`#5B21B6`, `#A855F7`, `#E879F9`, `#4C1D95`, `#2E1065`, `#2A1056`. The two
WhatsApp greens (`#25D366`, `#128C7E`) map to `--wa-1/--wa-2`, not the brand.

**Phase 1 acceptance:** `git diff` shows only color-plumbing changes; the running
site is pixel-for-pixel the same; build + e2e green. Commit:
`refactor(theme): centralize colors behind semantic CSS variables (no visual change)`.

---

## 4. Apply the new palette (Phase 2)

Now change **only the `:root` block from §3a**. Everything else inherits.

```css
:root {
  --surface:        #FBF8F2;  /* warm ivory */
  --surface-raised: #FFFFFF;
  --surface-sunken: #F2EBDD;  /* soft sand */

  --text:           #221B12;  /* espresso ink */
  --text-body:      #43392E;
  --text-muted:     #8A7E6E;

  --brand:          #221B12;  /* ink - primary buttons/links */
  --brand-strong:   #000000;
  --accent:         #C8962F;  /* gold/ochre - single accent  */
  --accent-strong:  #8A6A1A;  /* gold for SMALL text (AA on ivory) */

  --border:         rgba(34,27,18,0.12);
  --ring:           #C8962F;

  --ok:#1A7F4B; --danger:#B42318; --wa-1:#25D366; --wa-2:#128C7E;
  --banner-h:0px; --header-h:64px; --tab-h:68px;
}
```

Then, also in `globals.css` / config:

- **Body background:** delete the 4 stacked purple radial gradients. Use flat
  `var(--surface)`, optionally ONE ultra-subtle warm wash:
  `radial-gradient(ellipse 90% 60% at 50% -10%, rgba(200,150,47,0.06), transparent 60%)`.
- **Paper-grain overlay:** keep at `opacity:0.02` on desktop; **disable on mobile**
  (`@media (max-width:768px)`) - it's a full-screen `mix-blend-mode` layer that
  costs paint on phones.
- **Buttons:** ink fill, no gradient, no glow shadow. Hover = `--brand-strong`
  + a 1px lift, no 36px colored shadow.
- **Cards / `.glass` / `.glass-strong`:** drop `backdrop-filter: blur()`. Use
  solid `var(--surface-raised)` + `1px solid var(--border)` + a soft neutral
  shadow (`0 8px 24px -12px rgba(34,27,18,0.18)`). Blur is the biggest mobile
  perf cost here (it's in 8 components).
- **Remove** `.glow-hover`'s 60px colored glow; replace with the lift only.

### 4a. Define the missing `.gold-text` (NEW - currently a no-op)
`.gold-text` is referenced in **9 places** (Hero "Home", Footer "studio", admin
wordmark, the-craft, care-guide, the big serif numbers in `WhyChooseUs` &
`CustomOrderCTA`) but **is never defined**, so those words render plain. Add to
`@layer components`:

```css
.gold-text {
  background: linear-gradient(135deg, #E8C25A 0%, var(--accent) 45%, var(--accent-strong) 100%);
  -webkit-background-clip: text;  background-clip: text;
  -webkit-text-fill-color: transparent;  color: var(--accent-strong);
}
@supports not ((-webkit-background-clip:text) or (background-clip:text)) {
  .gold-text { color: var(--accent-strong); }  /* graceful fallback */
}
```
Use gold only on **large display words**; for any small text rely on
`--accent-strong` (contrast - see §7).

**Phase 2 acceptance:** whole site reads warm/ivory/ink/gold; no purple, no
glass blur, no glow; build + e2e green. Commit
`feat(theme): warm ivory + ink + gold palette`.

---

## 5. Hero + mobile-first composition (Phase 3)

### 5a. Merge the two heroes into one full-bleed section
`app/page.tsx` currently stacks `<HeroSlideshow/>` (framed) then a centered
`<Hero/>` text block. Replace with **one** full-bleed hero: the slideshow as a
full-viewport background, headline + CTAs overlaid, with a warm scrim for
legibility. Behaviour to preserve from `Hero.tsx`: the staggered framer-motion
reveal, the **primary `Explore Collections` → `/shop`** + quieter
**`Or order a custom piece` → `/custom-order`** hierarchy, and the trust strip
(Painting since 2020 · Free shipping ₹999 · 7-day returns). Reuse the existing
slideshow image list/state - don't rebuild the data.

Reference structure (adapt to your components; keep `next/link` routes):
- `section` height `100svh`, `min-height:600px`, `overflow:hidden`.
- Slides as absolutely-positioned layers, crossfade (`opacity` + slow scale).
- Warm scrim: `linear-gradient(105deg, rgba(34,27,18,.82), …, transparent)` so
  ink text stays legible over any photo while the palette stays warm (not a
  generic black overlay).
- Headline in `font-serif` (Cormorant) with the accent word in `.gold-text`.
- CTAs: primary = ivory fill / ink text; secondary = outline.
- Slide dots; reduced-motion users get a static first slide (respect the
  existing `prefers-reduced-motion` rule).

### 5b. Mobile-first rules (apply across the reskin)
- **Design at 360–390px first**, enhance up at `sm`/`lg`. Never let a row force
  horizontal scroll (the root already clamps `overflow-x`).
- **Tap targets ≥ 44×44px.** Buttons keep `min-h-12`; make icon-only controls
  (cart, search, drawer) at least 44px.
- **Type scale:** keep the existing `fontSize` ramp; ensure body never below
  16px on mobile (prevents iOS input zoom).
- **Safe areas:** keep `env(safe-area-inset-*)` on `BottomTabBar`,
  `StickyCartBar`, `.sticky-cta`.
- **Thumb reach:** primary actions reachable bottom-half; the bottom tab bar +
  sticky cart stay.
- **Images:** `output: 'export'` means `next/image` runs unoptimized - set
  explicit `sizes`, real `width`/`height` (no layout shift), and `priority`
  only on the hero's first slide; `loading="lazy"` everything below the fold.
- **Reduce motion on mobile:** the heavy ambient animations (`float`,
  `glow-pulse`, `slow-zoom`, `gentle-rotate`) should be desktop-only or removed.

**Phase 3 acceptance:** one full-bleed hero, great at 390px and at 1440px;
no horizontal scroll; tap targets pass; build + e2e green.

---

## 6. Performance budget (verify in Phase 4)
Most buyers are on mid-range Android in India - these are conversion + SEO wins:
- **No `backdrop-filter: blur()`** in the shipped CSS (removed in §4).
- **≤ 2** infinite CSS animations on any given screen.
- Lighthouse **mobile**: LCP < 2.5s, CLS < 0.1, TBT low. The hero's first image
  is the LCP element - preload/`priority` it, lazy-load the rest.
- Drop the body multi-gradient + mobile grain (done in §4).

---

## 7. Accessibility (must hold)
- Keep the skip-link, focus-visible rings (now `--ring` gold), and the
  `prefers-reduced-motion` block.
- **Contrast (WCAG AA):** ink `#221B12` on ivory `#FBF8F2` ≈ 14:1 ✓. Gold
  `#C8962F` on ivory is **~2:1 - fails for text**; therefore gold is allowed
  only on **large display** (≥24px/700, AA large = 3:1) or as a decorative
  fill. For small gold-ish text use `--accent-strong` `#8A6A1A` (≈ 4.7:1 ✓).
- White text on the ink primary button ≈ 14:1 ✓.
- Colour is never the only signal (keep icons/labels on states).

---

## 8. Phased execution checklist (do in order, commit each)

- [ ] **Phase 0 - Guardrails.** Confirm branch `develop`. Re-read §0 do-not-touch
      list. Baseline: `cd frontend && npm run build` and `npx playwright test`
      both green. Screenshot home/shop/product/cart on mobile + desktop widths.
- [ ] **Phase 1 - Centralize (no visual change).** §3a–3d. Vars == current
      values. Diff = plumbing only. Visual diff ≈ none. Build + e2e green.
      Commit.
- [ ] **Phase 2 - Reskin palette.** §4 + §4a. Edit `:root` only; kill purple
      gradients, glass blur, glows; define `.gold-text`. Build + e2e green.
      Commit.
- [ ] **Phase 3 - Hero + mobile-first.** §5. Merge heroes, full-bleed responsive
      hero, tap targets, image sizing, motion trim. Build + e2e green. Commit.
- [ ] **Phase 4 - QA.** §6 + §7. Lighthouse mobile, contrast check, click every
      nav route, add to cart, start a custom order - confirm nothing in the
      `lib/api.ts`/`stores` path was touched and flows still work. Commit.

If any e2e test asserts a literal old color (e.g. a hex/class), update the
**assertion** to the new value - do not weaken the wiring it guards.

---

## 9. Retheme later in 30 seconds (the payoff)
Because colour now lives in one `:root` block, a future seasonal theme (say a
deep-green festive look) is just:
```css
:root { --surface:#F4F1E9; --text:#1C2A22; --brand:#1C2A22; --accent:#C2693B; }
```
No component edits, no hex hunting, no broken wiring.
