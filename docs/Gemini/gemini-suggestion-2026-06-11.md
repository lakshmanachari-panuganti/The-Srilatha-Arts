# Gemini AI Frontend Review — Srilatha Arts
**Date:** 2026-06-11  
**Reviewed by:** Antigravity AI (Gemini)  
**Branch:** feature/ai-driven

---

## Summary

Full expert review of the frontend covering design system, color palette, typography, mobile/desktop UX, and actionable improvement suggestions.

---

## 🔴 Critical Fixes (P0)

### 1. ContactCTA — Broken Visual Contrast
`ContactCTA.tsx` uses `text-white` headings on `bg-gradient-to-br from-ivory via-ivory-soft to-ivory-mute`. In the token system, `ivory` = espresso dark `#221B12`, so this may render as dark text on dark background — invisible heading.

**Fix:** Replace background with a proper dark ink surface.

```tsx
// Replace the outer div background
<div className="relative overflow-hidden p-8 sm:p-12 lg:p-20 text-center rounded-4xl"
  style={{ background: 'linear-gradient(135deg, #1A1208 0%, #221B12 60%, #2D2416 100%)' }}
>
```

---

### 2. Footer Newsletter — Old Purple Focus Ring Color
`Footer.tsx` line 126 uses legacy lavender purple `rgba(200,182,255,0.4)` for the focus ring — does not match the current gold/warm palette.

**Fix:**
```tsx
onFocus={(e) => e.target.style.borderColor = 'rgba(200,150,47,0.5)'}
onBlur={(e) => e.target.style.borderColor = 'rgba(34,27,18,0.12)'}
```

---

## 🟠 High Priority (P1)

### 3. Collection Cards — `object-contain` Makes Art Look Like Product Thumbnails
`ShopByArtForm.tsx` uses `object-contain p-4` for card images. For art products, this shows floating images in white boxes — looks like a catalogue listing, not a gallery.

**Fix:** Change to `object-cover` and remove the padding.
```tsx
// Before
className="object-contain p-4 transition-transform ..."
// After
className="object-cover transition-transform ..."
```

### 4. Card Hover — Neutral Shadow → Gold Tint Border
Cards hover with a neutral grey shadow. For a luxury brand, gold tint borders feel more premium.

**Fix in `globals.css`:**
```css
.card:hover {
  box-shadow: 0 16px 32px -14px rgba(200, 150, 47, 0.15);
  border-color: rgba(200, 150, 47, 0.30);
}
```

### 5. Scrolled Header — No Backdrop Blur (Desktop)
The header transitions to a solid panel on scroll. Desktop blur is a premium signature.

**Fix in `globals.css`:**
```css
@media (min-width: 1024px) {
  .glass-strong {
    backdrop-filter: blur(16px) saturate(180%);
    -webkit-backdrop-filter: blur(16px) saturate(180%);
    background: rgba(251, 248, 242, 0.85) !important;
  }
}
```

### 6. BottomTabBar — Active Gold on Black = Low Contrast
Active tab uses `text-lavender-pastel` = `--accent-strong` = `#8A6A1A` on near-black background. Fails WCAG AA at small icon sizes.

**Fix:** Use brighter gold + add active dot indicator.
```tsx
// Active tab color change
active ? 'text-[#E8C25A]' : 'text-plum-warm'

// Add active indicator dot
{active && (
  <span className="absolute bottom-1 w-1 h-1 rounded-full"
    style={{ background: 'var(--accent)' }} />
)}
```

---

## 🟡 Medium Priority (P2)

### 7. Mobile Grid — 6 Single-Column Cards = Too Much Scroll
`ShopByArtForm.tsx` renders `grid-cols-1` on mobile — 6 full-width art cards stacked vertically.

**Fix:**
```tsx
className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8 lg:gap-10"
// + reduce mobile card padding:
className="... p-3 sm:p-5 sm:p-6"
```

### 8. Missing Entrance Animations on Several Sections
`OurStoryTeaser`, `Testimonials`, `ContactCTA` have no scroll-entrance animations, unlike `WhyChooseUs` and `CustomOrderCTA`.

**Fix:** Wrap section root in `motion.section` with `whileInView`:
```tsx
<motion.section
  initial={{ opacity: 0, y: 32 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: '-60px' }}
  transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
>
```

### 9. OurStoryTeaser — Remove "Coming Soon" Video Placeholder
The disabled play button + "coming soon" badge signals incompleteness on a luxury brand page. Replace with a static editorial art image until video is ready.

### 10. Testimonials — No Scroll Discovery Hint on Mobile
The mobile carousel (`-mx-5 overflow-x-auto snap-x`) has no visual indicator. Add a "swipe" hint caption or scroll progress dots.

### 11. Hero Trust Strip — 11px Text Too Small on Mobile
The trust strip uses `text-[11px]` on mobile. Bump to `text-xs` (14px per config) for better readability.

---

## 🟢 Low Priority / Nice-to-Have (P3)

### 12. Color Naming Semantic Confusion
Token aliases are inverted from what names suggest:
- `plum` → actually warm ivory surface `#FBF8F2`
- `ivory` → actually espresso dark text `#221B12`
- `lavender` → actually dark ink brand color

This is a future debt item. Add a top-level comment block in `tailwind.config.ts` to document the intentional inversion.

### 13. Indian Luxury Craft Theme Enhancement
Add terracotta micro-accent for section dividers and decorative dots:
```css
:root {
  --terracotta:     #C3501A;
  --terracotta-rgb: 195 80 26;
}
```

### 14. WhyChooseUs — Use `md:grid-cols-12` Instead of `lg:grid-cols-12`
The two-column layout only kicks in at `lg` (1024px). On iPad (~768px), everything stacks into one long column.

**Fix:**
```tsx
className="grid md:grid-cols-12 gap-12 lg:gap-16 items-start mb-24"
```

### 15. Mobile Header — Email Overflow on ≤375px Screens
The email + phone shown below icons may overflow on very small screens.

**Fix:**
```tsx
<span className="truncate max-w-[140px] text-[10px]">{STUDIO_EMAIL}</span>
```

---

## Implementation Checklist

- [ ] P0: Fix ContactCTA background to dark ink surface
- [ ] P0: Fix Footer newsletter focus ring to gold
- [ ] P1: Change card images from `object-contain p-4` → `object-cover`
- [ ] P1: Update `.card:hover` in globals.css to gold border + shadow
- [ ] P1: Add desktop `backdrop-filter: blur()` to `.glass-strong`
- [ ] P1: Fix BottomTabBar active color contrast + add dot indicator
- [ ] P2: Add `grid-cols-2` to ShopByArtForm on mobile
- [ ] P2: Add `motion.section` entrance animations to OurStoryTeaser, Testimonials, ContactCTA
- [ ] P2: Replace video placeholder with static art image in OurStoryTeaser
- [ ] P2: Add swipe hint to Testimonials mobile carousel
- [ ] P2: Bump hero trust strip to `text-xs` on mobile
- [ ] P3: Add WhyChooseUs `md:grid-cols-12`
- [ ] P3: Add mobile header email truncation
- [ ] P3: Document color token name inversion in tailwind.config.ts
