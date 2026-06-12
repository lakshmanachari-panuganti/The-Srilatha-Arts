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
        // ── Two-layer token system ─────────────────────────────────
        // Tailwind aliases here resolve to CSS variables defined in
        // app/globals.css `:root`. The variables are the single source
        // of truth — retheme by editing :root only. ~200 component
        // call sites use these names; do not rename them.
        //
        // Active theme: Premium Obsidian + Cyber Gold. All legacy
        // names ('plum', 'lavender', 'ivory', 'ink', etc.) are kept
        // and remapped at the :root layer so they resolve to the
        // obsidian palette.
        //
        // We use `rgb(var(--…-rgb) / <alpha-value>)` so opacity
        // modifiers (`bg-plum/40`, `border-ink/10`) compose alpha
        // at build time.
        // ─────────────────────────────────────────────────────────

        // Surface aliases → obsidian foundation
        plum:            'rgb(var(--bg-main-rgb) / <alpha-value>)',
        'plum-light':    'rgb(var(--bg-card-rgb) / <alpha-value>)',
        'plum-warm':     'rgb(var(--bg-surface-rgb) / <alpha-value>)',
        'lavender-light':'rgba(255,255,255,0.04)',
        'lavender-faint':'rgb(var(--bg-surface-rgb) / <alpha-value>)',
        cream:           'rgba(255,255,255,0.04)',
        'cream-deep':    'rgb(var(--bg-card-rgb) / <alpha-value>)',
        paper:           'rgb(var(--bg-glass-fallback-rgb) / <alpha-value>)',

        // Brand + accent aliases → cyber gold
        lavender:          'rgb(var(--accent-gold-rgb) / <alpha-value>)',
        'lavender-soft':   'rgb(var(--accent-gold-rgb) / <alpha-value>)',
        'lavender-pastel': 'rgb(var(--accent-gold-hover-rgb) / <alpha-value>)',
        'primary-dark':    'rgb(var(--accent-gold-rgb) / <alpha-value>)',
        'primary-burnt':   'rgb(var(--accent-gold-hover-rgb) / <alpha-value>)',

        // Text aliases — primary white, body slate-400, muted slate-500
        ivory:        'rgb(var(--text-primary-rgb) / <alpha-value>)',
        'ivory-soft': 'rgb(var(--text-secondary-rgb) / <alpha-value>)',
        'ivory-mute': 'rgb(var(--text-muted-rgb) / <alpha-value>)',
        ink:          'rgb(var(--text-primary-rgb) / <alpha-value>)',
        'ink-soft':   'rgb(var(--text-secondary-rgb) / <alpha-value>)',
        'ink-mute':   'rgb(var(--text-muted-rgb) / <alpha-value>)',

        // Navigation surfaces — obsidian translucent
        'nav-surface':       'rgba(16,18,22,0.92)',
        'nav-surface-heavy': 'rgba(7,8,10,0.97)',

        // Glass + overlays
        'glass-surface': 'rgba(16,18,22,0.65)',
        'glass-border':  'rgba(255,255,255,0.05)',
        'overlay-soft':  'rgba(250,204,21,0.08)',
        'overlay-deep':  'rgba(0,0,0,0.55)',
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
        // Obsidian gradients — replace legacy ivory/cream sweeps.
        'lavender-gradient': 'linear-gradient(135deg, #07080a 0%, #101216 50%, #15181e 100%)',
        'plum-gradient':     'linear-gradient(135deg, #07080a 0%, #101216 50%, #15181e 100%)',
      },
      maxWidth: {
        '8xl': '88rem',
        reader: '38rem',
      },
      boxShadow: {
        editorial: '0 30px 60px -20px rgba(0,0,0,0.65)',
        card: '0 8px 24px -12px rgba(0,0,0,0.55)',
        soft: '0 2px 12px -2px rgba(0,0,0,0.40)',
        // Gold glow shadows — used on CTAs, focal cards, hover lifts
        'lavender-glow':    '0 0 12px rgba(250,204,21,0.40), 0 8px 18px -10px rgba(0,0,0,0.50)',
        'lavender-glow-lg': '0 0 40px rgba(250,204,21,0.20), 0 0 12px rgba(250,204,21,0.40), 0 14px 28px -14px rgba(0,0,0,0.60)',
        glass: '0 8px 24px -12px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)',
      },
    },
  },
  plugins: [],
}

export default config
