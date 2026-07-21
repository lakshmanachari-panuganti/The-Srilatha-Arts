'use client'

import React, { useState } from 'react'
import { 
  Sparkles, 
  Copy, 
  Check, 
  Smartphone, 
  Monitor, 
  ArrowRight, 
  ShoppingBag, 
  Star, 
  Heart, 
  Paintbrush, 
  Grid, 
  MessageCircle,
  HelpCircle,
  ShieldCheck,
  Palette,
  ExternalLink,
  Info
} from 'lucide-react'
import { FreeShippingThreshold } from '@/components/ShippingFigures'

// Define the 4 custom Colorful Lavender Themes
interface ColorTheme {
  id: string
  name: string
  tagline: string
  description: string
  contrastAdvice: string
  colors: {
    surface: string
    surfaceRaised: string
    surfaceSunken: string
    text: string
    textBody: string
    textMuted: string
    brand: string
    brandStrong: string
    accent: string
    accentStrong: string
    border: string
  }
  prompts: {
    midjourney: string
    dalle: string
    v0: string
  }
}

const LAVENDER_THEMES: ColorTheme[] = [
  {
    id: 'velvet-marigold',
    name: 'Velvet Lavender & Warm Marigold',
    tagline: 'Heritage & Luxury Art Gallery',
    description: 'A luxurious fusion of soft lavender and deep royal indigo/plum, highlighted by a rich warm gold/marigold. This is perfect for handcrafted Indian folk art like Lippan mirror work and rich golden-laced resin art.',
    contrastAdvice: 'Ink-plum text (#2A1B3D) on Lavender-mist (#F7F4FA) has an exceptional 13.5:1 contrast ratio. Use the vibrant Marigold (#F59E0B) for accents, ribbon decorations, or buttons, and deep ochre (#D97706) for text-based highlights.',
    colors: {
      surface: '#F7F4FA',
      surfaceRaised: '#FFFFFF',
      surfaceSunken: '#EDE9F3',
      text: '#2A1B3D',
      textBody: '#453857',
      textMuted: '#7E6E90',
      brand: '#4A2E80',
      brandStrong: '#321D5B',
      accent: '#F59E0B',
      accentStrong: '#D97706',
      border: 'rgba(74,46,128,0.12)',
    },
    prompts: {
      midjourney: 'A premium luxury e-commerce banner showcasing handcrafted Indian art, Lippan art clay work with circular mirrors and a central mandala, and high-gloss epoxy resin coasters with gold-leaf flakes. Color palette of soft lavender-mist background, deep royal indigo-plum, and vibrant marigold gold accents. Cinematic studio lighting, shallow depth of field, 8k resolution, photorealistic, premium editorial style --ar 16:9 --style raw',
      dalle: 'High-end flatlay photography of handcrafted resin art coasters with gold glitter flakes and a Lippan clay mandala panel on a soft lavender table. Deep purple shadows, vibrant marigold flowers scattered, high contrast, warm premium art gallery aesthetic.',
      v0: 'Create a Next.js ecommerce landing page for premium handcrafted art. The layout should have a soft lavender-mist background (#F7F4FA), text in velvet plum (#2A1B3D), primary action buttons in royal purple (#4A2E80) with a glossy resin-like finish, and decorative ribbons, sale tags, and rating stars in bright marigold gold (#F59E0B). Include clean cards for Lippan mirror art and epoxy resin art galleries.'
    }
  },
  {
    id: 'lavender-sage',
    name: 'Dreamy Lavender & Eucalyptus Sage',
    tagline: 'Organic, Botanical & Earthy Craft Vibe',
    description: 'A calming and organic pairing of soft lavender with muted eucalyptus/sage green. It reflects natural clay, raw wood bases, and garden-inspired handmade creations.',
    contrastAdvice: 'Deep charcoal-plum (#221C2B) on lavender-white (#F9F8FA) passes AAA contrast. The eucalyptus green (#1E3F35) serves as a steady, grounded anchor for buttons, while vivid lavender-violet (#9333EA) draws attention to micro-actions.',
    colors: {
      surface: '#F9F8FA',
      surfaceRaised: '#FFFFFF',
      surfaceSunken: '#EFF0EF',
      text: '#221C2B',
      textBody: '#3C3545',
      textMuted: '#7A7285',
      brand: '#1E3F35',
      brandStrong: '#0F241E',
      accent: '#9333EA',
      accentStrong: '#7C3AED',
      border: 'rgba(30,63,53,0.10)',
    },
    prompts: {
      midjourney: 'A serene display of handmade home decor art on a textured plaster wall. Lavender watercolor canvas paintings, eucalyptus branches in clay pottery, and geometric Lippan clay mirrors. Color theme of earthy lavender, sage green, and white linen. Soft natural sunlight, organic textures, Wabi-Sabi aesthetic, high-end design catalog photography --ar 16:9',
      dalle: 'A minimalist botanical shop banner with handmade arts. Lavender clay pottery, sage green leaves, soft purple accent details, and light gray linen textures. Clean, modern, organic craft aesthetic.',
      v0: 'Create a clean, minimalist craft store homepage. Background: light lavender-white (#F9F8FA), typography: dark charcoal (#221C2B), buttons: rich eucalyptus green (#1E3F35) with smooth hover transitions, accents/sale stickers: bright violet-purple (#9333EA). The layout should showcase handcrafted terracotta plates and custom pottery.'
    }
  },
  {
    id: 'amethyst-coral',
    name: 'Vibrant Amethyst & Peachy Coral',
    tagline: 'Modern, Energetic & Artistically Playful',
    description: 'An artistic, high-energy palette representing the vibrant, colorful swirls found in fluid acrylic pours and glossy resin art. Pairs lavender and amethyst with a cheerful peachy coral.',
    contrastAdvice: 'Deep purple (#3B0764) text is extremely readable on the light amethyst wash (#FAF5FF). Use the gorgeous coral-pink (#F43F5E) for buttons, ribbons, or price tags, and dark rose (#BE185D) for small high-contrast textual links.',
    colors: {
      surface: '#FAF5FF',
      surfaceRaised: '#FFFFFF',
      surfaceSunken: '#F3E8FF',
      text: '#3B0764',
      textBody: '#582E87',
      textMuted: '#9370DB',
      brand: '#7E22CE',
      brandStrong: '#581C87',
      accent: '#F43F5E',
      accentStrong: '#BE185D',
      border: 'rgba(126,34,206,0.12)',
    },
    prompts: {
      midjourney: 'Abstract modern liquid resin art pour, glossy surface catching direct studio lights, swirling patterns of deep amethyst purple, lavender mist, and bright peachy coral. Tiny gold glitter speckles. Macro photography, high contrast, glamorous, fluid art --ar 16:9',
      dalle: 'Close up of a vibrant handmade round Lippan art piece with mirror mosaics. Hand-painted in amethyst purple and coral pink. Modern creative home decor display, clean product photography.',
      v0: 'Design a highly energetic shop layout for a modern creative art studio. Color palette: Light amethyst background (#FAF5FF), deep purple typography (#3B0764), key call-to-actions in vibrant coral-rose (#F43F5E) with magnetic zoom animations on hover. Grid items should feature colorful resin art trays and custom orders.'
    }
  },
  {
    id: 'twilight-obsidian',
    name: 'Mystical Twilight (Dark Mode)',
    tagline: 'Immersive Dark Velvet Art Gallery',
    description: 'A dark, mystical palette simulating a gallery at dusk. Deep obsidian-purple grounds the page, while neon orchid ribbons and electric gold typography make colorful art pieces pop like neon under spotlights.',
    contrastAdvice: 'Lavender ice text (#F3E8FF) on deep obsidian (#110A1C) provides a comfortable dark-mode reading experience. The electric gold (#FCD34D) passes contrast rules on dark surfaces, making it great for tags and buttons.',
    colors: {
      surface: '#110A1C',
      surfaceRaised: '#1E142F',
      surfaceSunken: '#0B0512',
      text: '#F3E8FF',
      textBody: '#D8B4FE',
      textMuted: '#8B5CF6',
      brand: '#A855F7',
      brandStrong: '#C084FC',
      accent: '#F472B6',
      accentStrong: '#FCD34D',
      border: 'rgba(168,85,247,0.22)',
    },
    prompts: {
      midjourney: 'A dark-mode premium gallery setting with spotlights highlighting neon resin coasters and golden mandala wall decor. Background is a deep twilight purple. Specular reflections on high-gloss epoxy, neon orchid and electric gold sparks. Mysterious, high-end, luxury mood, dark theme --ar 16:9',
      dalle: 'Handcrafted glowing resin art dish on a dark purple stone table under warm spotlighting. Neon purple, orchid pink, and gold flakes, luxury dark-mode showcase style.',
      v0: 'Create a dark-mode portfolio and shop website for a resin artist. Base theme: deep obsidian violet (#110A1C), cards: raised purple-black panels (#1E142F) with thin neon borders (#A855F7). Buttons should be glossy electric purple with glowing hover rings. Typography in lavender-ice (#F3E8FF) and gold (#FCD34D).'
    }
  }
]

// Helper function to convert hex code to "R G B" triplet for Tailwind fallback
function hexToRgbTriplet(hex: string): string {
  const cleanHex = hex.replace('#', '')
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16)
    const g = parseInt(cleanHex[1] + cleanHex[1], 16)
    const b = parseInt(cleanHex[2] + cleanHex[2], 16)
    return `${r} ${g} ${b}`
  }
  const r = parseInt(cleanHex.substring(0, 2), 16)
  const g = parseInt(cleanHex.substring(2, 4), 16)
  const b = parseInt(cleanHex.substring(4, 6), 16)
  return `${r} ${g} ${b}`
}

export default function ThemePreviewPage() {
  const [activeTheme, setActiveTheme] = useState<ColorTheme>(LAVENDER_THEMES[0])
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [viewportMode, setViewportMode] = useState<'desktop' | 'mobile'>('desktop')
  const [specularPos, setSpecularPos] = useState({ x: '50%', y: '30%' })

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Handle pointer tracking for the glossy resin plate specular highlight
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = `${((e.clientX - rect.left) / rect.width) * 100}%`
    const y = `${((e.clientY - rect.top) / rect.height) * 100}%`
    setSpecularPos({ x, y })
  }

  // Generate the CSS variable block for copy-pasting into globals.css
  const getCssVariableBlock = (theme: ColorTheme) => {
    return `:root {
  /* Surfaces - Lavender Theme */
  --surface:        ${theme.colors.surface};
  --surface-rgb:    ${hexToRgbTriplet(theme.colors.surface)};
  --surface-raised: ${theme.colors.surfaceRaised};
  --surface-raised-rgb: ${hexToRgbTriplet(theme.colors.surfaceRaised)};
  --surface-sunken: ${theme.colors.surfaceSunken};
  --surface-sunken-rgb: ${hexToRgbTriplet(theme.colors.surfaceSunken)};

  /* Text - High contrast */
  --text:           ${theme.colors.text};
  --text-rgb:       ${hexToRgbTriplet(theme.colors.text)};
  --text-body:      ${theme.colors.textBody};
  --text-body-rgb:  ${hexToRgbTriplet(theme.colors.textBody)};
  --text-muted:     ${theme.colors.textMuted};
  --text-muted-rgb: ${hexToRgbTriplet(theme.colors.textMuted)};

  /* Brand and Accents */
  --brand:          ${theme.colors.brand};
  --brand-rgb:      ${hexToRgbTriplet(theme.colors.brand)};
  --brand-strong:   ${theme.colors.brandStrong};
  --brand-strong-rgb: ${hexToRgbTriplet(theme.colors.brandStrong)};
  --accent:         ${theme.colors.accent};
  --accent-rgb:     ${hexToRgbTriplet(theme.colors.accent)};
  --accent-strong:  ${theme.colors.accentStrong};
  --accent-strong-rgb: ${hexToRgbTriplet(theme.colors.accentStrong)};

  --border:         ${theme.colors.border};
  --ring:           ${theme.colors.accent};
}`
  }

  // Generate inline styles to inject current theme properties into the preview container
  const getThemeInlineStyles = (theme: ColorTheme) => {
    return {
      '--surface': theme.colors.surface,
      '--surface-rgb': hexToRgbTriplet(theme.colors.surface),
      '--surface-raised': theme.colors.surfaceRaised,
      '--surface-raised-rgb': hexToRgbTriplet(theme.colors.surfaceRaised),
      '--surface-sunken': theme.colors.surfaceSunken,
      '--surface-sunken-rgb': hexToRgbTriplet(theme.colors.surfaceSunken),
      '--text': theme.colors.text,
      '--text-rgb': hexToRgbTriplet(theme.colors.text),
      '--text-body': theme.colors.textBody,
      '--text-body-rgb': hexToRgbTriplet(theme.colors.textBody),
      '--text-muted': theme.colors.textMuted,
      '--text-muted-rgb': hexToRgbTriplet(theme.colors.textMuted),
      '--brand': theme.colors.brand,
      '--brand-rgb': hexToRgbTriplet(theme.colors.brand),
      '--brand-strong': theme.colors.brandStrong,
      '--brand-strong-rgb': hexToRgbTriplet(theme.colors.brandStrong),
      '--accent': theme.colors.accent,
      '--accent-rgb': hexToRgbTriplet(theme.colors.accent),
      '--accent-strong': theme.colors.accentStrong,
      '--accent-strong-rgb': hexToRgbTriplet(theme.colors.accentStrong),
      '--border': theme.colors.border,
      '--ring': theme.colors.accent,
      color: theme.colors.text,
      backgroundColor: theme.colors.surface,
      transition: 'all 0.5s cubic-bezier(0.22, 1, 0.36, 1)'
    } as React.CSSProperties
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-6 md:p-12 relative overflow-hidden selection:bg-purple-800 selection:text-white">
      
      {/* Dynamic Background Blur Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[120px] pointer-events-none" />

      {/* Upper Brand Header */}
      <header className="max-w-7xl mx-auto mb-16 border-b border-slate-800 pb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="p-2 bg-purple-500/20 text-purple-400 rounded-lg border border-purple-500/30">
              <Palette className="h-6 w-6" />
            </span>
            <span className="text-xs font-semibold tracking-widest uppercase text-purple-400">Theme Laboratory</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold font-serif tracking-tight text-white mb-3 leading-none">
            Srilatha Art <span className="font-serif italic font-normal text-purple-400">Lavender Swatches</span>
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-2xl">
            A premium playground designed to visualize and test colorful lavender palettes. Switch themes interactively 
            to see live rendering of buttons, typographic contrast, glossy resin art, and traditional clay mandalas.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 px-5 py-2.5 rounded-lg text-xs font-bold tracking-widest uppercase text-slate-200 hover:text-white transition-all shadow-md"
          >
            <span>Visit live site</span>
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </header>

      {/* Main Lab Grid */}
      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 relative z-10">
        
        {/* LEFT COLUMN: Controls, Swatches, Copy CSS (5 Columns) */}
        <section className="lg:col-span-5 flex flex-col gap-8">
          
          {/* 1. Theme Selector Grid */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <Sparkles className="h-20 w-20 text-purple-400" />
            </div>
            
            <h2 className="text-lg font-bold text-white flex items-center gap-2.5 mb-5 border-b border-slate-800/50 pb-3">
              <Palette className="h-5 w-5 text-purple-400" />
              Theme Configuration
            </h2>
            
            <div className="flex flex-col gap-3.5">
              {LAVENDER_THEMES.map((theme) => {
                const isActive = activeTheme.id === theme.id
                return (
                  <button
                    key={theme.id}
                    onClick={() => setActiveTheme(theme)}
                    className={`w-full text-left p-5 rounded-lg border transition-all duration-300 relative ${
                      isActive 
                        ? 'bg-purple-950/20 border-purple-500/60 shadow-inner' 
                        : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/30'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="font-bold text-white text-base flex items-center gap-2">
                        {theme.name}
                        {isActive && <span className="h-2.5 w-2.5 bg-purple-400 rounded-full animate-pulse" />}
                      </span>
                      {/* Mini Swatch Ribbon */}
                      <div className="flex gap-1 bg-slate-950/80 p-1.5 rounded-full border border-slate-800">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: theme.colors.surface }} />
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: theme.colors.brand }} />
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: theme.colors.accent }} />
                      </div>
                    </div>
                    <span className="block text-xs font-semibold text-purple-400 mb-1.5 tracking-wider uppercase">{theme.tagline}</span>
                    <span className="block text-xs text-slate-400 leading-relaxed line-clamp-2">{theme.description}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 2. Color Swatch Matrix */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl shadow-lg">
            <h2 className="text-lg font-bold text-white mb-4 border-b border-slate-800/50 pb-3">Theme Swatches</h2>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(activeTheme.colors).map(([key, value]) => (
                <div key={key} className="bg-slate-950/60 border border-slate-800/40 rounded-xl p-3 flex items-center gap-3">
                  <span 
                    className="w-10 h-10 rounded-lg shrink-0 border border-slate-800 flex items-center justify-center text-xs font-mono font-bold shadow-sm"
                    style={{ 
                      backgroundColor: value, 
                      color: key === 'surface' || key === 'surfaceRaised' ? '#000' : '#fff' 
                    }}
                  />
                  <div>
                    <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{key.replace(/([A-Z])/g, ' $1')}</span>
                    <span className="block text-xs font-mono text-white font-bold">{value}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Contrast and Accessibility Warning */}
            <div className="mt-5 p-4 bg-purple-950/20 border border-purple-900/30 rounded-2xl text-xs text-purple-300 flex items-start gap-2.5">
              <Info className="h-4 w-4 shrink-0 text-purple-400 mt-0.5" />
              <div>
                <span className="font-semibold block mb-1">Contrast & Usage Advice:</span>
                {activeTheme.contrastAdvice}
              </div>
            </div>
          </div>

          {/* 3. CSS Variable Copy Block */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl shadow-lg flex-1 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-bold text-white">CSS Variables</h2>
                <button
                  onClick={() => copyToClipboard(getCssVariableBlock(activeTheme), 'css-var')}
                  className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-purple-300 hover:text-purple-200 px-3.5 py-2 rounded-xl border border-slate-700 transition-all"
                >
                  {copiedId === 'css-var' ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-green-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy code</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                Replace the <code className="text-purple-400 font-mono">:root</code> block in your 
                <code className="text-slate-300 font-mono"> app/globals.css</code> file to retheme the entire website.
              </p>
            </div>
            <pre className="text-[11px] font-mono text-purple-200 bg-slate-950 p-4 rounded-2xl overflow-x-auto max-h-52 border border-slate-800 scrollbar-thin">
              {getCssVariableBlock(activeTheme)}
            </pre>
          </div>

        </section>

        {/* RIGHT COLUMN: Live Viewport Preview (7 Columns) */}
        <section className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Viewport Control Bar */}
          <div className="flex items-center justify-between bg-slate-900/40 border border-slate-800/80 rounded-full px-6 py-3.5 backdrop-blur-xl shadow-lg">
            <div className="flex items-center gap-2.5">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-widest text-slate-300">Live Preview Sandbox</span>
            </div>

            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setViewportMode('desktop')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold tracking-wider uppercase transition-all ${
                  viewportMode === 'desktop' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Monitor className="h-3.5 w-3.5" />
                <span>Desktop</span>
              </button>
              <button
                onClick={() => setViewportMode('mobile')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold tracking-wider uppercase transition-all ${
                  viewportMode === 'mobile' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span>Mobile</span>
              </button>
            </div>
          </div>

          {/* Sandbox Wrapper Container */}
          <div className="w-full flex justify-center items-start">
            <div 
              className={`w-full overflow-hidden transition-all duration-500 border border-slate-800/60 shadow-2xl relative ${
                viewportMode === 'mobile' ? 'max-w-[390px] rounded-[36px] min-h-[740px]' : 'max-w-full rounded-[24px] min-h-[640px]'
              }`}
              style={{ 
                backgroundColor: 'var(--surface)', 
                borderColor: '#1e293b' 
              }}
            >
              {/* If Mobile, render a device header */}
              {viewportMode === 'mobile' && (
                <div className="w-full bg-slate-950 text-slate-400 text-[10px] px-6 py-2.5 flex justify-between items-center border-b border-slate-900 font-mono z-20 relative">
                  <span>9:41 TSA</span>
                  <div className="w-24 h-4 bg-slate-900 rounded-full border border-slate-800 absolute left-1/2 -translate-x-1/2 flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-slate-950" />
                  </div>
                  <div className="flex gap-1.5 items-center">
                    <span className="w-2.5 h-2.5 bg-slate-700 rounded-full" />
                    <span className="w-3.5 h-2.5 bg-slate-700 rounded-sm" />
                  </div>
                </div>
              )}

              {/* INJECTED CSS CONTAINER - Simulation starts here */}
              <div 
                style={getThemeInlineStyles(activeTheme)} 
                className="w-full min-h-full font-sans text-left pb-12 transition-colors duration-500"
              >
                
                {/* 1. Header Navigation Bar */}
                <nav 
                  className="px-6 py-4 flex items-center justify-between border-b transition-colors duration-500 sticky top-0 backdrop-blur-md z-10"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'rgba(var(--surface-raised-rgb) / 0.85)' }}
                >
                  <div className="flex items-center gap-1.5">
                    {/* Decorative Kolam/Dot logo */}
                    <span 
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ background: 'var(--brand)' }}
                    >
                      S
                    </span>
                    <span className="font-serif font-bold tracking-wider text-base" style={{ color: 'var(--text)' }}>
                      SRILATHA <span className="font-serif italic font-normal" style={{ color: 'var(--accent-strong)' }}>ART</span>
                    </span>
                  </div>

                  <div className="hidden md:flex gap-6 text-xs font-semibold uppercase tracking-wider">
                    <span className="cursor-pointer font-bold" style={{ color: 'var(--brand)' }}>Shop</span>
                    <span className="cursor-pointer" style={{ color: 'var(--text-body)' }}>Custom Orders</span>
                    <span className="cursor-pointer" style={{ color: 'var(--text-body)' }}>Our Story</span>
                  </div>

                  <div className="flex items-center gap-3.5">
                    <button className="relative p-1">
                      <ShoppingBag className="h-5 w-5" style={{ color: 'var(--text)' }} />
                      <span 
                        className="absolute -top-1 -right-1.5 text-[9px] font-bold w-4.5 h-4.5 rounded-full flex items-center justify-center text-white shadow-sm"
                        style={{ backgroundColor: 'var(--accent)' }}
                      >
                        2
                      </span>
                    </button>
                  </div>
                </nav>

                {/* 2. Top Banner (Ribbon) */}
                <div 
                  className="px-4 py-2.5 text-center text-xs font-bold tracking-widest uppercase transition-colors"
                  style={{ backgroundColor: 'var(--accent)', color: activeTheme.id === 'twilight-obsidian' ? '#000' : '#FFF' }}
                >
                  ✨ Free Shipping Across India above <FreeShippingThreshold /> ✨
                </div>

                {/* 3. Hero Showcase Area */}
                <div className="px-6 py-12 md:py-20 relative overflow-hidden text-center">
                  {/* Backdrop subtle gradient */}
                  <div 
                    className="absolute inset-0 opacity-15 pointer-events-none"
                    style={{ 
                      backgroundImage: `radial-gradient(ellipse at 50% -20%, var(--accent) 0%, transparent 65%)` 
                    }}
                  />
                  
                  <div className="max-w-xl mx-auto relative z-10">
                    {/* Eyebrow Label */}
                    <div className="inline-flex items-center gap-1.5 mb-4">
                      <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ backgroundColor: 'var(--accent)' }} />
                      <span className="text-[10px] uppercase font-bold tracking-widest" style={{ color: 'var(--accent-strong)' }}>
                        Premium Handcrafted Studio
                      </span>
                    </div>

                    {/* Headline */}
                    <h3 className="text-3xl md:text-5xl font-serif font-medium leading-tight mb-5" style={{ color: 'var(--text)' }}>
                      Handcrafted with <span className="font-serif italic font-normal text-gradient" style={{ color: 'var(--accent-strong)' }}>Heart & Soul</span>
                    </h3>

                    {/* Subtext */}
                    <p className="text-xs md:text-sm leading-relaxed mb-8 max-w-lg mx-auto" style={{ color: 'var(--text-body)' }}>
                      Unique home decoratives and art statement pieces. Specializing in high-gloss fluid resin panels, 
                      traditional Lippan mirror work mandalas, and custom wedding gifts.
                    </p>

                    {/* CTAs */}
                    <div className="flex flex-wrap items-center justify-center gap-3.5">
                      <button 
                        className="px-8 py-3 rounded-lg text-xs font-bold uppercase tracking-wider text-white shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
                        style={{ backgroundColor: 'var(--brand)' }}
                      >
                        Explore shop
                      </button>
                      <button 
                        className="px-6 py-3 rounded-lg text-xs font-bold uppercase tracking-wider border hover:bg-slate-50/5 transition-all"
                        style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                      >
                        Custom Order
                      </button>
                    </div>
                  </div>
                </div>

                {/* 4. Category / Chip Rail */}
                <div className="px-6 mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                      Art categories
                    </h4>
                    <span className="text-[10px] font-bold uppercase tracking-wider cursor-pointer" style={{ color: 'var(--accent-strong)' }}>
                      See all
                    </span>
                  </div>
                  
                  <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
                    {['Resin Art', 'Lippan Mirrors', 'Dot Mandalas', 'Wedding Decor'].map((cat, idx) => (
                      <span 
                        key={idx} 
                        className="px-5 py-2 text-xs rounded-lg border font-semibold shrink-0 cursor-pointer transition-colors shadow-sm"
                        style={{ 
                          backgroundColor: idx === 0 ? 'var(--brand)' : 'var(--surface-raised)',
                          color: idx === 0 ? '#FFFFFF' : 'var(--text)',
                          borderColor: idx === 0 ? 'transparent' : 'var(--border)'
                        }}
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 5. Product Showcase Grid */}
                <div className="px-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Product Card 1: Resin Coasters */}
                  <div 
                    onMouseMove={handleMouseMove}
                    className="border rounded-[28px] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 group cursor-pointer relative"
                    style={{ backgroundColor: 'var(--surface-raised)', borderColor: 'var(--border)' }}
                  >
                    
                    {/* Simulated resin-plate / visual representation of artwork */}
                    <div className="h-48 relative bg-slate-900 overflow-hidden flex items-center justify-center p-4">
                      
                      {/* Specular resin sheen overlay catching pointer movement */}
                      <div 
                        className="absolute inset-0 pointer-events-none mix-blend-screen opacity-40 z-10 transition-all duration-300"
                        style={{
                          background: `radial-gradient(280px circle at ${specularPos.x} ${specularPos.y}, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.05) 40%, transparent 70%)`
                        }}
                      />

                      {/* Fluid Resin Gradient Art illustration */}
                      <div 
                        className="absolute inset-0 opacity-80 blur-[2px] scale-105 group-hover:scale-110 transition-all duration-700"
                        style={{
                          backgroundImage: `radial-gradient(circle at 35% 30%, var(--brand) 0%, transparent 60%), radial-gradient(circle at 65% 70%, var(--accent) 0%, transparent 60%)`
                        }}
                      />

                      {/* Floating Sticker badge */}
                      <span 
                        className="absolute top-4 left-4 px-3 py-1.5 text-[9px] uppercase font-extrabold text-white rounded-full tracking-widest shadow"
                        style={{ backgroundColor: 'var(--brand)' }}
                      >
                        Best seller
                      </span>

                      <span className="relative text-xs font-serif font-bold text-white drop-shadow-md border border-white/20 bg-black/40 backdrop-blur-md px-3.5 py-2 rounded-xl">
                        Epoxy Ocean Platter
                      </span>
                    </div>

                    <div className="p-5">
                      <div className="flex justify-between items-start mb-1.5">
                        <h5 className="font-bold text-sm tracking-tight" style={{ color: 'var(--text)' }}>Ocean Wave Resin Tray</h5>
                        <div className="flex items-center gap-0.5 text-xs" style={{ color: 'var(--accent-strong)' }}>
                          <Star className="h-3.5 w-3.5 fill-current" />
                          <span className="font-bold">4.9</span>
                        </div>
                      </div>
                      <p className="text-xs mb-4" style={{ color: 'var(--text-body)' }}>Handmade food-safe serving dish with real golden handles.</p>
                      
                      <div className="flex justify-between items-center border-t border-dashed pt-4" style={{ borderColor: 'var(--border)' }}>
                        <span className="font-mono font-bold text-base" style={{ color: 'var(--text)' }}>₹2,499</span>
                        <button 
                          className="p-2 rounded-lg hover:scale-105 transition-all text-white shadow"
                          style={{ backgroundColor: 'var(--brand)' }}
                        >
                          <ShoppingBag className="h-4.5 w-4.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Product Card 2: Lippan Art */}
                  <div 
                    className="border rounded-[28px] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 group cursor-pointer"
                    style={{ backgroundColor: 'var(--surface-raised)', borderColor: 'var(--border)' }}
                  >
                    {/* Simulated Lippan Mirror Art illustration */}
                    <div className="h-48 relative bg-slate-950 overflow-hidden flex items-center justify-center p-4">
                      
                      {/* Mandala circles & mirror illustrations */}
                      <div className="w-32 h-32 rounded-full border-4 border-dashed border-white/10 flex items-center justify-center relative animate-spin-slow">
                        <div className="w-24 h-24 rounded-full border border-double border-white/20 flex items-center justify-center">
                          <div className="w-12 h-12 rounded-full border border-white/30 bg-white/5 backdrop-blur-sm" />
                        </div>
                        {/* Mirror diamonds simulation */}
                        <div className="absolute top-2 w-3.5 h-3.5 bg-white/80 rotate-45 shadow-sm" />
                        <div className="absolute bottom-2 w-3.5 h-3.5 bg-white/80 rotate-45 shadow-sm" />
                        <div className="absolute left-2 w-3.5 h-3.5 bg-white/80 rotate-45 shadow-sm" />
                        <div className="absolute right-2 w-3.5 h-3.5 bg-white/80 rotate-45 shadow-sm" />
                      </div>

                      <div 
                        className="absolute inset-0 opacity-35 mix-blend-overlay"
                        style={{ backgroundColor: 'var(--accent)' }}
                      />

                      {/* Discount sticker */}
                      <span 
                        className="absolute top-4 left-4 px-3 py-1.5 text-[9px] uppercase font-extrabold text-slate-950 rounded-full tracking-widest shadow"
                        style={{ backgroundColor: 'var(--accent)' }}
                      >
                        15% OFF
                      </span>

                      <span className="absolute bottom-4 right-4 text-[10px] font-mono font-bold text-white/90 bg-slate-900/60 backdrop-blur-sm px-2.5 py-1 rounded-lg">
                        12" MDF Base
                      </span>
                    </div>

                    <div className="p-5">
                      <div className="flex justify-between items-start mb-1.5">
                        <h5 className="font-bold text-sm tracking-tight" style={{ color: 'var(--text)' }}>Royal Peacock Lippan Art</h5>
                        <div className="flex items-center gap-0.5 text-xs" style={{ color: 'var(--accent-strong)' }}>
                          <Star className="h-3.5 w-3.5 fill-current" />
                          <span className="font-bold">5.0</span>
                        </div>
                      </div>
                      <p className="text-xs mb-4" style={{ color: 'var(--text-body)' }}>Clay mirror work mandala crafted on solid MDF base.</p>
                      
                      <div className="flex justify-between items-center border-t border-dashed pt-4" style={{ borderColor: 'var(--border)' }}>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-base" style={{ color: 'var(--text)' }}>₹1,699</span>
                          <span className="font-mono text-[11px] line-through text-slate-500" style={{ color: 'var(--text-muted)' }}>₹1,999</span>
                        </div>
                        <button 
                          className="p-2 rounded-lg hover:scale-105 transition-all text-white shadow"
                          style={{ backgroundColor: 'var(--brand)' }}
                        >
                          <ShoppingBag className="h-4.5 w-4.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 6. Custom Inquiry Banner */}
                <div className="mx-6 mt-10 p-6 rounded-[28px] border flex flex-col md:flex-row md:items-center justify-between gap-5 transition-colors shadow-sm"
                     style={{ backgroundColor: 'var(--surface-sunken)', borderColor: 'var(--border)' }}>
                  <div>
                    <h5 className="text-sm font-bold tracking-tight mb-1" style={{ color: 'var(--text)' }}>
                      Looking for custom wedding decor or sizes?
                    </h5>
                    <p className="text-xs" style={{ color: 'var(--text-body)' }}>
                      Let Srilatha personalize a unique artwork or set matching your colors.
                    </p>
                  </div>
                  <button 
                    className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold text-white hover:scale-102 active:scale-98 transition-all shrink-0 shadow-md"
                    style={{ backgroundColor: '#128C7E' }} // WhatsApp Green
                  >
                    <MessageCircle className="h-4 w-4 fill-white" />
                    <span>WhatsApp Inquiry</span>
                  </button>
                </div>

              </div>

            </div>
          </div>

        </section>

      </main>

      {/* LOWER SECTION: AI Prompts Generator */}
      <section className="max-w-7xl mx-auto mt-16 bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-lg relative z-10">
        <div className="flex items-center gap-3 mb-4 border-b border-slate-800/50 pb-4">
          <Sparkles className="h-6 w-6 text-purple-400" />
          <h2 className="text-xl md:text-2xl font-bold text-white font-serif">
            Lavender Color Theme AI Prompt Toolkit
          </h2>
        </div>
        <p className="text-slate-400 text-sm max-w-3xl mb-8">
          Use these copyable, highly tailored AI prompts to generate visually matching assets, backgrounds, 
          and layouts for your website matching the <strong className="text-white">{activeTheme.name}</strong> theme palette.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Prompt Card 1: Midjourney */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between shadow">
            <div>
              <div className="flex justify-between items-start mb-4">
                <span className="text-xs font-bold text-purple-400 uppercase tracking-widest bg-purple-950/50 border border-purple-800/50 px-2.5 py-1 rounded">
                  Midjourney Prompt
                </span>
                <button
                  onClick={() => copyToClipboard(activeTheme.prompts.midjourney, 'mj-prompt')}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all"
                  title="Copy Prompt"
                >
                  {copiedId === 'mj-prompt' ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <h4 className="text-sm font-bold text-white mb-2">High-Fidelity Photo Assets</h4>
              <p className="text-xs text-slate-400 leading-relaxed mb-4 italic">
                "&ldquo;{activeTheme.prompts.midjourney}&rdquo;"
              </p>
            </div>
            <div className="text-[10px] text-slate-500 border-t border-slate-900 pt-3">
              ⚡ Recommended for premium website hero backgrounds, collection headers, and promotional posters.
            </div>
          </div>

          {/* Prompt Card 2: DALL-E 3 */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between shadow">
            <div>
              <div className="flex justify-between items-start mb-4">
                <span className="text-xs font-bold text-blue-400 uppercase tracking-widest bg-blue-950/50 border border-blue-800/50 px-2.5 py-1 rounded">
                  DALL-E 3 Prompt
                </span>
                <button
                  onClick={() => copyToClipboard(activeTheme.prompts.dalle, 'de-prompt')}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all"
                  title="Copy Prompt"
                >
                  {copiedId === 'de-prompt' ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <h4 className="text-sm font-bold text-white mb-2">Clean Product flatlays</h4>
              <p className="text-xs text-slate-400 leading-relaxed mb-4 italic">
                "&ldquo;{activeTheme.prompts.dalle}&rdquo;"
              </p>
            </div>
            <div className="text-[10px] text-slate-500 border-t border-slate-900 pt-3">
              ⚡ Best suited for isolated social posts, custom order sliders, and transparent product feature backgrounds.
            </div>
          </div>

          {/* Prompt Card 3: v0 / Claude UI */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between shadow">
            <div>
              <div className="flex justify-between items-start mb-4">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest bg-emerald-950/50 border border-emerald-800/50 px-2.5 py-1 rounded">
                  AI UI Builder Prompt
                </span>
                <button
                  onClick={() => copyToClipboard(activeTheme.prompts.v0, 'v0-prompt')}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all"
                  title="Copy Prompt"
                >
                  {copiedId === 'v0-prompt' ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <h4 className="text-sm font-bold text-white mb-2">v0 / Claude Coding instructions</h4>
              <p className="text-xs text-slate-400 leading-relaxed mb-4 italic">
                "&ldquo;{activeTheme.prompts.v0}&rdquo;"
              </p>
            </div>
            <div className="text-[10px] text-slate-500 border-t border-slate-900 pt-3">
              ⚡ Feed this instruction directly into v0.dev, Claude, or Lovable to generate stunning sample pages in code.
            </div>
          </div>

        </div>
      </section>

      {/* Footer Info */}
      <footer className="max-w-7xl mx-auto mt-16 text-center text-xs text-slate-600 border-t border-slate-900 pt-6">
        <p>Srilatha Art Customization Suite &copy; 2026. Made with dedication for premium craftsmanship.</p>
      </footer>
    </div>
  )
}
