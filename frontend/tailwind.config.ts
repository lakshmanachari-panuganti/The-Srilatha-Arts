import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Navigation dark surfaces ──────────────────────────────
        'nav-surface': 'rgba(76,29,149,0.92)',   // BottomTabBar / StickyCartBar bg
        'nav-surface-heavy': 'rgba(76,29,149,0.97)', // SearchOverlay bg
        // ── Surfaces (Vibrant Lavender) ──────────────────────────
        plum: '#EDE9FE',                 // violet-100 — visible lavender page bg
        'plum-light': '#DDD6FE',         // violet-200 — richer lavender
        'plum-warm': '#C4B5FD',          // violet-300 — deep lavender mist
        lavender: '#7C3AED',             // violet-600 — vivid primary brand
        'lavender-soft': '#A78BFA',      // violet-400 — vibrant medium
        'lavender-pastel': '#E879F9',    // fuchsia-400 — vivid magenta accent
        'lavender-light': '#F5F3FF',     // violet-50  — lightest surface
        'lavender-faint': '#EDE9FE',     // violet-100 — faint lavender
        // ── Text (calibrated hierarchy — warm violet undertone) ──
        // Names kept for back-compat (token rename would ripple ~200
        // call sites). Values rebalanced so the hierarchy is correct:
        // headline > body > muted, in both contrast and saturation.
        // Prior values had `ivory-mute` (#6D28D9, violet-700) MORE
        // saturated than the body tone above it — a brand-coloured
        // "muted" reads as purple, not as muted. Fixed below.
        ivory: '#2A1056',                // primary text — deep violet, still
                                          // rich enough to read editorial on
                                          // light-lavender bg
        'ivory-soft': '#3D2F55',         // body text — warm desaturated plum,
                                          // calm enough to read as TEXT
                                          // rather than as "purple"
        'ivory-mute': '#7B6F8A',         // muted captions / meta — properly
                                          // muted warm grey-violet, lighter
                                          // and less saturated than body
        // ── Glass & Overlay (Lavender Mode) ──────────────────────
        'glass-surface': 'rgba(237,233,254,0.70)',
        'glass-border': 'rgba(167,139,250,0.40)',
        'glass-hover': 'rgba(221,214,254,0.90)',
        'overlay-soft': 'rgba(124,58,237,0.08)',
        'overlay-deep': 'rgba(46,16,101,0.35)',
        // ── Legacy aliases (lavender-aliased back-compat tokens) ──
        // These names predate the cream→lavender pivot; their *values*
        // were remapped to lavender equivalents so existing call sites
        // keep working. ink-* mirrors ivory-* for the same hierarchy
        // (see ivory comments above).
        cream: '#F5F3FF',
        'cream-deep': '#DDD6FE',
        paper: 'rgba(237,233,254,0.70)',
        ink: '#2A1056',                  // mirrors `ivory`
        'ink-soft': '#3D2F55',            // mirrors `ivory-soft`
        'ink-mute': '#7B6F8A',            // mirrors `ivory-mute`
        'primary-dark': '#7C3AED',
        'primary-burnt': '#A78BFA',
        // Gold tokens — used for the `.gold-text` gradient + accent
        // numerals + review stars. Suited for LARGE text (≥18px) only;
        // small body text in gold fails contrast on the light lavender
        // page. Use `text-lavender` for actionable links instead.
        gold: '#D4AF37',
        'gold-light': '#F3D27A',
        'gold-deep': '#B8962E',
        // NOTE: `terracotta`, `terracotta-deep`, `clay`, `sage` tokens
        // were removed on 2026-05-31. They were leftover from an earlier
        // craft-palette concept and had been remapped to amber-200
        // (#FDE68A — a pale yellow) which became unreadable text on the
        // light-lavender page. All call sites have been migrated to
        // `lavender` / `lavender-pastel` / `rose-700` per intent.
      },
      fontFamily: {
        // Three-font system, each with a clear role:
        //
        //   sans  → DM Sans (body, UI, buttons, prices, nav, eyebrows).
        //           Variable weight, proper small-size rendering.
        //   serif → Cormorant Garamond (display headlines, italic accent
        //           words, editorial pull-quotes). High-contrast capitals
        //           that hold up under the uppercase headlines used
        //           sitewide. Replaced the prior single-weight Aldo,
        //           which faux-bolded under font-semibold/bold and read
        //           stiff under uppercase.
        //   brand → Square Peg, reserved exclusively for the "Srilatha
        //           Art" wordmark. Do not use it elsewhere.
        //
        // CSS variables come from next/font/google in app/layout.tsx —
        // see the Typography comment block there for the loader config.
        sans:  ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-cormorant)', 'Georgia', 'serif'],
        brand: ['var(--font-square-peg)', 'Square Peg', 'cursive'],
      },
      fontSize: {
        '10': ['0.625rem', { lineHeight: '1.5' }],   // 10px — label caps, tab bar text
        '11': ['0.6875rem', { lineHeight: '1.5' }],  // 11px — eyebrow / sticker
        xs: ['14px', { lineHeight: '1.5' }],
        sm: ['14px', { lineHeight: '1.5' }],
        base: ['16px', { lineHeight: '1.65' }],
        lg: ['18px', { lineHeight: '1.6' }],
        xl: ['18px', { lineHeight: '1.2' }],
        '2xl': ['20px', { lineHeight: '1.2' }],
        '3xl': ['24px', { lineHeight: '1.2' }],
        '4xl': ['32px', { lineHeight: '1.15' }],
        '5xl': ['40px', { lineHeight: '1.12' }],
        '6xl': ['56px', { lineHeight: '1.1' }],
        '7xl': ['64px', { lineHeight: '1.1' }],
        '8xl': ['88px', { lineHeight: '1.05' }],
      },
      letterSpacing: {
        'editor': '0.32em',
      },
      borderRadius: {
        '2xl': '20px',
        '3xl': '24px',
        '4xl': '32px',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
        'slow-zoom': {
          '0%': { transform: 'scale(1)' },
          '100%': { transform: 'scale(1.05)' },
        },
        'gentle-rotate': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        marquee: 'marquee 30s linear infinite',
        shimmer: 'shimmer 3s ease-in-out infinite',
        'fade-up': 'fade-up 0.8s ease-out forwards',
        float: 'float 8s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 4s ease-in-out infinite',
        'slow-zoom': 'slow-zoom 20s ease-in-out infinite alternate',
        'gentle-rotate': 'gentle-rotate 60s linear infinite',
      },
      backgroundImage: {
        'paper-grain':
          "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.35'/%3E%3C/svg%3E\")",
        'lavender-gradient': 'linear-gradient(135deg, #EFE7FF 0%, #E9D5FF 45%, #D8B4F8 100%)',
        'plum-gradient': 'linear-gradient(135deg, #FFFFFF 0%, #F8F4FF 50%, #EFE7FF 100%)',
      },
      maxWidth: {
        '8xl': '88rem',
        reader: '38rem',
      },
      boxShadow: {
        editorial: '0 30px 60px -20px rgba(75, 63, 114, 0.15)',
        card: '0 8px 32px -8px rgba(75, 63, 114, 0.12)',
        soft: '0 2px 12px -2px rgba(75, 63, 114, 0.08)',
        'lavender-glow': '0 0 30px rgba(216, 180, 248, 0.4)',
        'lavender-glow-lg': '0 0 60px rgba(216, 180, 248, 0.45)',
        glass: '0 8px 32px 0 rgba(75, 63, 114, 0.1)',
      },
    },
  },
  plugins: [],
}

export default config
