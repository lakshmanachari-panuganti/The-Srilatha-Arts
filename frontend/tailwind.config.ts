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
        // ── Surfaces ─────────────────────────────────────────────
        plum: '#2B1E34',                  // deep plum — primary bg
        'plum-light': '#362840',          // slightly lighter layered surface
        'plum-warm': '#3F304A',           // warm mid-tone for cards
        lavender: '#5E4B8B',             // royal lavender — section accent
        'lavender-soft': '#8A74C9',      // soft purple accent
        'lavender-pastel': '#C8B6FF',    // pastel lavender highlight
        'lavender-light': '#E9E4FF',     // light lavender for tags/badges
        'lavender-faint': '#F8F7FC',     // warm soft white
        // ── Text ─────────────────────────────────────────────────
        ivory: '#F8F7FC',                // warm soft white — primary text
        'ivory-soft': '#DDD8EB',         // secondary text
        'ivory-mute': '#A49BB8',         // tertiary / meta text
        // ── Glass & Overlay ──────────────────────────────────────
        'glass-surface': 'rgba(255,255,255,0.06)',
        'glass-border': 'rgba(255,255,255,0.12)',
        'glass-hover': 'rgba(255,255,255,0.10)',
        'overlay-soft': 'rgba(0,0,0,0.30)',
        'overlay-deep': 'rgba(0,0,0,0.50)',
        // ── Legacy aliases (kept so old imports don't break) ─────
        cream: '#F8F7FC',
        'cream-deep': '#362840',
        paper: 'rgba(255,255,255,0.06)',
        ink: '#F8F7FC',
        'ink-soft': '#DDD8EB',
        'ink-mute': '#A49BB8',
        'primary-dark': '#5E4B8B',
        'primary-burnt': '#8A74C9',
        terracotta: '#8A74C9',
        'terracotta-deep': '#5E4B8B',
        gold: '#C8B6FF',
        'gold-light': '#E9E4FF',
        'gold-deep': '#5E4B8B',
        clay: '#8A74C9',
        sage: '#9B8EC4',
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
          "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.65'/%3E%3C/svg%3E\")",
        'lavender-gradient': 'linear-gradient(135deg, #C8B6FF 0%, #8A74C9 45%, #5E4B8B 100%)',
        'plum-gradient': 'linear-gradient(135deg, #3F304A 0%, #2B1E34 50%, #1E1528 100%)',
      },
      maxWidth: {
        '8xl': '88rem',
        reader: '38rem',
      },
      boxShadow: {
        editorial: '0 30px 60px -20px rgba(43, 30, 52, 0.5)',
        card: '0 8px 32px -8px rgba(43, 30, 52, 0.4)',
        soft: '0 2px 12px -2px rgba(43, 30, 52, 0.3)',
        'lavender-glow': '0 0 30px rgba(138, 116, 201, 0.2)',
        'lavender-glow-lg': '0 0 60px rgba(138, 116, 201, 0.25)',
        glass: '0 8px 32px 0 rgba(43, 30, 52, 0.37)',
      },
    },
  },
  plugins: [],
}

export default config
