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
        // ── Surface ────────────────────────────────────────────────
        cream: '#FAF6EE',            // primary background — warm off-white
        'cream-deep': '#F1E9D9',     // section background, subtle warmth
        paper: '#FFFFFF',            // card surface
        // ── Ink ────────────────────────────────────────────────────
        ink: '#1F140C',              // primary text, dark cocoa
        'ink-soft': '#5C4A3C',       // secondary text
        'ink-mute': '#8C7B6B',       // tertiary / meta text
        // ── Accent ─────────────────────────────────────────────────
        terracotta: '#A14B1A',       // primary brand accent
        'terracotta-deep': '#8B3A0E',
        clay: '#D88452',             // soft warm accent
        gold: '#B8941F',             // refined gold for light theme
        'gold-deep': '#8E6F12',
        'gold-light': '#E8D08A',
        sage: '#7A8B6C',             // editorial secondary accent
        // ── Legacy aliases (kept so old imports don't break) ──────
        'primary-dark': '#8B3A0E',
        'primary-burnt': '#A14B1A',
      },
      fontFamily: {
        serif: ['var(--font-cormorant)', 'Cormorant Garamond', 'serif'],
        sans: ['var(--font-montserrat)', 'Montserrat', 'system-ui', 'sans-serif'],
        hand: ['var(--font-caveat)', 'Caveat', 'cursive'],
      },
      fontSize: {
        xs: ['11px', { lineHeight: '1.5' }],
        sm: ['13px', { lineHeight: '1.55' }],
        base: ['15px', { lineHeight: '1.65' }],
        lg: ['17px', { lineHeight: '1.6' }],
        xl: ['20px', { lineHeight: '1.4' }],
        '2xl': ['26px', { lineHeight: '1.25' }],
        '3xl': ['34px', { lineHeight: '1.15' }],
        '4xl': ['44px', { lineHeight: '1.05' }],
        '5xl': ['56px', { lineHeight: '1.02' }],
        '6xl': ['72px', { lineHeight: '1' }],
        '7xl': ['88px', { lineHeight: '0.98' }],
        '8xl': ['112px', { lineHeight: '0.96' }],
      },
      letterSpacing: {
        'editor': '0.32em',
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
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        marquee: 'marquee 30s linear infinite',
        shimmer: 'shimmer 3s ease-in-out infinite',
        'fade-up': 'fade-up 0.6s ease-out forwards',
        float: 'float 6s ease-in-out infinite',
      },
      backgroundImage: {
        'paper-grain':
          "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.65'/%3E%3C/svg%3E\")",
      },
      maxWidth: {
        '8xl': '88rem',
        reader: '38rem',
      },
      boxShadow: {
        editorial: '0 30px 60px -20px rgba(31, 20, 12, 0.18)',
        card: '0 8px 24px -8px rgba(31, 20, 12, 0.12)',
        soft: '0 2px 8px -2px rgba(31, 20, 12, 0.08)',
      },
    },
  },
  plugins: [],
}

export default config
