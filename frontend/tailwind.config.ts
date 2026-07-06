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
        // app/globals.css `:root`. Active theme: AndroAI dark variant
        // (slate-950 canvas + brightened blue/indigo/cyan accents).
        // Legacy names ('plum', 'lavender', 'ivory', 'ink') remap so
        // ~200 component call sites continue to resolve correctly.
        // ─────────────────────────────────────────────────────────

        blue: {
          DEFAULT: 'rgb(var(--accent-blue-rgb) / <alpha-value>)',
          strong:  'rgb(var(--accent-blue-hover-rgb) / <alpha-value>)',
        },
        indigo: {
          DEFAULT: 'rgb(var(--accent-indigo-rgb) / <alpha-value>)',
          strong:  'rgb(var(--accent-indigo-hover-rgb) / <alpha-value>)',
        },
        cyan: {
          DEFAULT: 'rgb(var(--accent-cyan-rgb) / <alpha-value>)',
        },
        slate: {
          50:  'rgb(var(--text-primary-rgb) / <alpha-value>)',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: 'rgb(var(--text-secondary-rgb) / <alpha-value>)',
          400: 'rgb(var(--text-muted-rgb) / <alpha-value>)',
          500: 'rgb(var(--text-muted-rgb) / <alpha-value>)',
          700: '#334155',
          800: '#1E293B',
          900: 'rgb(var(--bg-surface-rgb) / <alpha-value>)',
          950: 'rgb(var(--bg-main-rgb) / <alpha-value>)',
        },

        // Surface aliases → dark canvas
        plum:            'rgb(var(--bg-main-rgb) / <alpha-value>)',
        'plum-light':    'rgb(var(--bg-card-rgb) / <alpha-value>)',
        'plum-warm':     'rgb(var(--bg-surface-rgb) / <alpha-value>)',
        'lavender-light':'rgba(255,255,255,0.04)',
        'lavender-faint':'rgb(var(--bg-surface-rgb) / <alpha-value>)',
        cream:           'rgba(255,255,255,0.04)',
        'cream-deep':    'rgb(var(--bg-card-rgb) / <alpha-value>)',
        paper:           'rgb(var(--bg-glass-fallback-rgb) / <alpha-value>)',

        // Brand + accent aliases → brightened royal blue / indigo
        lavender:          'rgb(var(--accent-blue-rgb) / <alpha-value>)',
        'lavender-soft':   'rgb(var(--accent-indigo-rgb) / <alpha-value>)',
        'lavender-pastel': 'rgb(var(--accent-indigo-rgb) / <alpha-value>)',
        'primary-dark':    'rgb(var(--accent-blue-rgb) / <alpha-value>)',
        'primary-burnt':   'rgb(var(--accent-blue-hover-rgb) / <alpha-value>)',

        // Text aliases - primary slate-50 (light on dark), body slate-300, muted slate-400
        ivory:        'rgb(var(--text-primary-rgb) / <alpha-value>)',
        'ivory-soft': 'rgb(var(--text-secondary-rgb) / <alpha-value>)',
        'ivory-mute': 'rgb(var(--text-muted-rgb) / <alpha-value>)',
        ink:          'rgb(var(--text-primary-rgb) / <alpha-value>)',
        'ink-soft':   'rgb(var(--text-secondary-rgb) / <alpha-value>)',
        'ink-mute':   'rgb(var(--text-muted-rgb) / <alpha-value>)',

        // Navigation surfaces - frosted dark
        'nav-surface':       'rgba(15,23,42,0.85)',
        'nav-surface-heavy': 'rgba(11,17,32,0.95)',

        // Glass + overlays
        'glass-surface': 'rgba(15,23,42,0.72)',
        'glass-border':  'rgba(148,163,184,0.10)',
        'overlay-soft':  'rgba(59,130,246,0.10)',
        'overlay-deep':  'rgba(0,0,0,0.65)',
      },
      fontFamily: {
        sans:    ['var(--font-jakarta)', 'var(--font-dm-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-jakarta)', 'system-ui', 'sans-serif'],
        serif:   ['var(--font-cormorant)', 'Georgia', 'serif'],
        brand:   ['"Pramukh Rounded"', 'sans-serif'],
      },
      fontSize: {
        '10': ['0.625rem', { lineHeight: '1.5' }],
        '11': ['0.6875rem', { lineHeight: '1.5' }],
        xs: ['0.8125rem', { lineHeight: '1.5' }],
        sm: ['0.875rem', { lineHeight: '1.55' }],
        base: ['1rem', { lineHeight: '1.65' }],
        lg: ['1.125rem', { lineHeight: '1.6' }],
        xl: ['1.25rem', { lineHeight: '1.45' }],
        '2xl': ['1.5rem', { lineHeight: '1.35' }],
        '3xl': ['1.875rem', { lineHeight: '1.25' }],
        '4xl': ['2.25rem', { lineHeight: '1.15' }],
        '5xl': ['2.75rem', { lineHeight: '1.10' }],
        '6xl': ['3.5rem', { lineHeight: '1.05' }],
        '7xl': ['4.25rem', { lineHeight: '1.02' }],
        '8xl': ['5.5rem', { lineHeight: '1.0' }],
      },
      letterSpacing: {
        'editor': '0.24em',
        'tightest': '-0.03em',
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
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-16px) rotate(2deg)' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.55', transform: 'scale(1)' },
          '50%': { opacity: '0.95', transform: 'scale(1.05)' },
        },
        'slow-zoom': {
          '0%': { transform: 'scale(1)' },
          '100%': { transform: 'scale(1.05)' },
        },
        'gentle-rotate': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
      animation: {
        marquee: 'marquee 30s linear infinite',
        shimmer: 'shimmer 3s ease-in-out infinite',
        'fade-up': 'fade-up 0.8s cubic-bezier(0.22,1,0.36,1) forwards',
        'fade-in': 'fade-in 0.6s ease-out forwards',
        float: 'float 8s ease-in-out infinite',
        'float-slow': 'float-slow 12s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 4s ease-in-out infinite',
        'slow-zoom': 'slow-zoom 20s ease-in-out infinite alternate',
        'gentle-rotate': 'gentle-rotate 60s linear infinite',
        'gradient-shift': 'gradient-shift 12s ease infinite',
      },
      backgroundImage: {
        'paper-grain':
          "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.18'/%3E%3C/svg%3E\")",
        // Dark gradients
        'lavender-gradient': 'linear-gradient(135deg, #0B1120 0%, #0F172A 50%, #111827 100%)',
        'plum-gradient':     'linear-gradient(135deg, #0B1120 0%, #0F172A 50%, #111827 100%)',
        'hero-aurora':       'radial-gradient(80% 60% at 50% 0%, rgba(59,130,246,0.28), transparent 60%), radial-gradient(60% 60% at 100% 30%, rgba(99,102,241,0.22), transparent 60%), radial-gradient(60% 50% at 0% 80%, rgba(34,211,238,0.16), transparent 60%)',
        'brand-gradient':    'linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-indigo) 100%)',
        'brand-gradient-soft':'linear-gradient(135deg, rgba(59,130,246,0.18) 0%, rgba(129,140,248,0.14) 100%)',
      },
      maxWidth: {
        '8xl': '88rem',
        reader: '38rem',
        container: '1280px',
      },
      boxShadow: {
        editorial: '0 20px 50px -22px rgba(0,0,0,0.55)',
        card: '0 1px 2px rgba(0,0,0,0.40), 0 12px 32px -8px rgba(0,0,0,0.50)',
        'card-hover': '0 2px 4px rgba(0,0,0,0.50), 0 22px 50px -12px rgba(59,130,246,0.25), 0 0 0 1px rgba(59,130,246,0.20)',
        soft: '0 1px 4px rgba(0,0,0,0.40)',
        // Neon glow shadows (legacy names retained, blue-routed)
        'lavender-glow':    '0 0 0 1px rgba(59,130,246,0.40), 0 6px 18px rgba(59,130,246,0.38), 0 0 24px rgba(99,102,241,0.28)',
        'lavender-glow-lg': '0 0 0 1px rgba(59,130,246,0.60), 0 16px 44px rgba(59,130,246,0.55), 0 0 56px rgba(99,102,241,0.45)',
        'blue-glow':        '0 0 0 1px rgba(59,130,246,0.40), 0 6px 18px rgba(59,130,246,0.38), 0 0 24px rgba(99,102,241,0.28)',
        'blue-glow-lg':     '0 0 0 1px rgba(59,130,246,0.60), 0 16px 44px rgba(59,130,246,0.55), 0 0 56px rgba(99,102,241,0.45)',
        glass: '0 1px 2px rgba(0,0,0,0.40), 0 8px 32px -12px rgba(0,0,0,0.55)',
      },
    },
  },
  plugins: [],
}

export default config
