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
        // ── Surfaces (Bright & Airy) ────────────────────────────
        plum: '#F8F4FF',                 // lavender white - primary bg (was dark plum)
        'plum-light': '#EFE7FF',         // soft pastel lavender
        'plum-warm': '#E9D5FF',          // lavender mist
        lavender: '#C8A2F0',             // orchid lavender - section accent
        'lavender-soft': '#D8B4F8',      // elegant lavender
        'lavender-pastel': '#FFB7D5',    // blush pink accent
        'lavender-light': '#FFFFFF',     // pure white for bright cards
        'lavender-faint': '#F8F4FF',     // warm soft white
        // ── Text (Elegant Plum) ──────────────────────────────────
        ivory: '#4B3F72',                // elegant plum - primary text (was white)
        'ivory-soft': '#6B5B95',         // muted lavender text
        'ivory-mute': '#8A7BAb',         // lighter muted text
        // ── Glass & Overlay (Light Mode) ─────────────────────────
        'glass-surface': 'rgba(255,255,255,0.60)',
        'glass-border': 'rgba(255,255,255,0.80)',
        'glass-hover': 'rgba(255,255,255,0.90)',
        'overlay-soft': 'rgba(248,244,255,0.60)',
        'overlay-deep': 'rgba(75,63,114,0.30)',
        // ── Legacy aliases (mapped to new light theme) ───────────
        cream: '#FFFFFF',
        'cream-deep': '#EFE7FF',
        paper: 'rgba(255,255,255,0.60)',
        ink: '#4B3F72',                  // primary text
        'ink-soft': '#6B5B95',           // secondary text
        'ink-mute': '#8A7BAb',           // tertiary text
        'primary-dark': '#C8A2F0',
        'primary-burnt': '#D8B4F8',
        terracotta: '#FFD6BA',           // soft peach
        'terracotta-deep': '#FFB7D5',    // blush pink
        gold: '#D4AF37',                 // antique gold
        'gold-light': '#F3D27A',         // champagne gold
        'gold-deep': '#B8962E',
        clay: '#FFD6BA',
        sage: '#A7F3D0',                 // muted mint
      },
      fontFamily: {
        serif: ['var(--font-playfair)', 'Playfair Display', 'serif'],
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
