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
        // ── Two-layer system ───────────────────────────────────────
        // Tailwind tokens here are *aliases* of CSS variables defined
        // in app/globals.css `:root`. The variables are the single
        // source of truth - change them to retheme. Names kept for
        // back-compat with ~200 call sites; values resolve at runtime.
        //
        // We use `rgb(var(--…-rgb) / <alpha-value>)` so opacity
        // modifiers (`bg-plum/40`, `border-ink/10`, `text-lavender-
        // pastel/60`) keep composing alpha at build time.
        //
        // Phase 1 of the reskin centralises colour without changing
        // visuals. Phase 2 swaps the `:root` block (only) to warm
        // ivory + ink + gold.
        // ─────────────────────────────────────────────────────────

        // ── IMPORTANT: Token name inversion ─────────────────────────
        // These token NAMES are legacy aliases from the old lavender-plum
        // theme and are semantically INVERTED from what you'd expect:
        //
        //   `plum`    → actually the WARM IVORY SURFACE  (#FBF8F2)
        //   `ivory`   → actually the DARK ESPRESSO TEXT  (#221B12)
        //   `lavender`→ actually the DARK INK BRAND COLOR (#221B12)
        //
        // This is intentional for back-compat with ~200 call sites.
        // Do NOT rename without a site-wide find-and-replace.
        // Use CSS variables (var(--surface), var(--text), var(--brand))
        // for any new code to avoid ambiguity.
        // ─────────────────────────────────────────────────────────────

        // Surfaces - page, raised cards, sunken alt sections
        plum:            'rgb(var(--surface-rgb) / <alpha-value>)',
        'plum-light':    'rgb(var(--surface-sunken-rgb) / <alpha-value>)',
        'plum-warm':     'rgb(var(--surface-sunken-rgb) / <alpha-value>)',
        'lavender-light':'rgb(var(--surface-raised-rgb) / <alpha-value>)',
        'lavender-faint':'rgb(var(--surface-rgb) / <alpha-value>)',
        cream:           'rgb(var(--surface-raised-rgb) / <alpha-value>)',
        'cream-deep':    'rgb(var(--surface-sunken-rgb) / <alpha-value>)',
        paper:           'rgb(var(--surface-raised-rgb) / <alpha-value>)',

        // Brand + accent. `lavender-pastel` is used on small-text links
        // across the site (FAQ, contact, custom-order…) so it points at
        // --accent-strong (deeper gold, AA-passing on ivory at text size)
        // rather than the bright --accent. The `.gold-text` display class
        // and hover states are where the bright gold lives.
        lavender:          'rgb(var(--brand-rgb) / <alpha-value>)',
        'lavender-soft':   'rgb(var(--brand-rgb) / <alpha-value>)',
        'lavender-pastel': 'rgb(var(--accent-strong-rgb) / <alpha-value>)',
        'primary-dark':    'rgb(var(--brand-rgb) / <alpha-value>)',
        'primary-burnt':   'rgb(var(--brand-strong-rgb) / <alpha-value>)',

        // Text - ivory-* and ink-* are both kept and point at the
        // same vars; existing call sites use both interchangeably.
        ivory:        'rgb(var(--text-rgb) / <alpha-value>)',
        'ivory-soft': 'rgb(var(--text-body-rgb) / <alpha-value>)',
        'ivory-mute': 'rgb(var(--text-muted-rgb) / <alpha-value>)',
        ink:          'rgb(var(--text-rgb) / <alpha-value>)',
        'ink-soft':   'rgb(var(--text-body-rgb) / <alpha-value>)',
        'ink-mute':   'rgb(var(--text-muted-rgb) / <alpha-value>)',

        // Navigation dark surfaces (BottomTabBar / StickyCartBar /
        // SearchOverlay). Translucent shells derived from brand-strong.
        'nav-surface':       'rgb(var(--brand-strong-rgb) / 0.92)',
        'nav-surface-heavy': 'rgb(var(--brand-strong-rgb) / 0.97)',

        // Glass + overlays
        'glass-surface': 'rgb(var(--surface-rgb) / 0.70)',
        'glass-border':  'var(--border)',
        'glass-hover':   'rgb(var(--surface-sunken-rgb) / <alpha-value>)',
        'overlay-soft':  'rgb(var(--brand-rgb) / 0.08)',
        'overlay-deep':  'rgb(var(--text-rgb) / 0.35)',
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
        // CSS variables come from next/font/google in app/layout.tsx -
        // see the Typography comment block there for the loader config.
        sans:  ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-cormorant)', 'Georgia', 'serif'],
        brand: ['"Pramukh Rounded"', 'sans-serif'],
      },
      fontSize: {
        '10': ['0.625rem', { lineHeight: '1.5' }],   // 10px - label caps, tab bar text
        '11': ['0.6875rem', { lineHeight: '1.5' }],  // 11px - eyebrow / sticker
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
        'lavender-gradient': 'linear-gradient(135deg, #FFFFFF 0%, #FBF8F2 45%, #F2EBDD 100%)',
        'plum-gradient': 'linear-gradient(135deg, #FFFFFF 0%, #FBF8F2 50%, #F2EBDD 100%)',
      },
      maxWidth: {
        '8xl': '88rem',
        reader: '38rem',
      },
      boxShadow: {
        editorial: '0 30px 60px -20px rgba(34, 27, 18, 0.18)',
        card: '0 8px 24px -12px rgba(34, 27, 18, 0.18)',
        soft: '0 2px 12px -2px rgba(34, 27, 18, 0.08)',
        // The `lavender-glow*` keys are kept for back-compat but the
        // colored glow is intentionally retired - these now resolve
        // to a soft neutral lift, matching the rest of the theme.
        'lavender-glow':   '0 8px 18px -10px rgba(34, 27, 18, 0.18)',
        'lavender-glow-lg':'0 14px 28px -14px rgba(34, 27, 18, 0.22)',
        glass: '0 8px 24px -12px rgba(34, 27, 18, 0.18)',
      },
    },
  },
  plugins: [],
}

export default config
