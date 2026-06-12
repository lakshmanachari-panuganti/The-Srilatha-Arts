'use client'
/**
 * HomeHero — pure-black editorial hero, mobile-first.
 *
 * Three-line sequential tagline reveal on a #000 canvas. Each phrase
 * fades up slowly with a one-second pause between lines, so the user
 * reads them as discrete vows rather than a single block of marketing
 * copy. After all three are visible they stay; the supporting
 * subtitle, CTAs, and social row reveal in a quieter trailing wave.
 *
 *   Intentionally handcrafted.        → craftsmanship
 *   Securely delivered.               → care
 *   Forever treasured.                → legacy
 *
 * Period in each line is set in cyber gold — the single accent on the
 * canvas. Headline is Cormorant Garamond (font-serif), sentence case,
 * subtly tracked, generous leading. Layout is centred on mobile and
 * left-aligned from `sm` upward.
 *
 * Animation tempo (calibrated against Apple / Aesop / Aman timing):
 *   t=0.30s  Line 1 starts (1.2s duration → fully visible at 1.50s)
 *   t=2.00s  Line 2 starts after a 0.5s held pause
 *   t=3.70s  Line 3 starts after a 0.5s held pause
 *   t=5.20s  Subtitle reveals
 *   t=5.60s  CTAs reveal
 *   t=6.00s  Social row reveals
 *
 * prefers-reduced-motion freezes everything at its final state — the
 * reader still gets the full hero, just without the choreography.
 *
 * a11y: the three phrases sit inside a single h1; the gold period is a
 * decorative <span aria-hidden> so screen-readers don't say "full stop"
 * three times.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

const EASE_LUXURY = [0.22, 1, 0.36, 1] as const

interface RevealProps {
  delay: number
  duration?: number
  reduceMotion: boolean
  className?: string
  children: React.ReactNode
  as?: 'span' | 'p' | 'div'
}

function Reveal({
  delay,
  duration = 1.2,
  reduceMotion,
  className,
  children,
  as = 'span',
}: RevealProps) {
  const Tag = motion[as]
  if (reduceMotion) {
    return <Tag className={className}>{children}</Tag>
  }
  return (
    <Tag
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay, ease: EASE_LUXURY }}
      className={className}
    >
      {children}
    </Tag>
  )
}

export default function HomeHero() {
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduceMotion(mql.matches)
    const onChange = (e: MediaQueryListEvent) => setReduceMotion(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  // Decorative gold period — paired with each tagline line.
  const Period = () => (
    <span aria-hidden style={{ color: 'var(--accent-gold)' }}>.</span>
  )

  return (
    <section
      aria-label="Welcome to Srilatha Art"
      className="relative w-full overflow-hidden"
      style={{
        minHeight: '100svh',
        background: '#000000',
      }}
    >
      {/* Soft top vignette — gives the fixed Header glyphs a near-black
          backing without painting a hard band across the canvas. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-40 z-[1]"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.40) 60%, transparent 100%)',
        }}
      />

      {/* Editorial content. Centred on mobile (the three vows read like
          a poem and centring respects that); left-aligned from sm up so
          desktop keeps editorial weight on the left third. */}
      <div className="relative z-[2] flex items-center" style={{ minHeight: '100svh' }}>
        <div
          className="w-full max-w-7xl mx-auto
                     px-5 sm:px-8 lg:px-16
                     pt-28 sm:pt-32 pb-28 sm:pb-32"
        >
          <div className="max-w-3xl mx-auto sm:mx-0 text-center sm:text-left">
            <h1
              className="text-white
                         text-[2.25rem] leading-[1.18]
                         sm:text-6xl sm:leading-[1.12]
                         lg:text-7xl lg:leading-[1.08]
                         xl:text-8xl xl:leading-[1.05]"
              style={{
                fontFamily: 'var(--font-fraunces), Georgia, serif',
                fontWeight: 400,
                fontOpticalSizing: 'auto',
                letterSpacing: '-0.015em',
                textShadow: 'none',
              }}
            >
              <Reveal as="span" delay={0.30} reduceMotion={reduceMotion} className="block">
                Intentionally handcrafted<Period />
              </Reveal>

              <Reveal as="span" delay={2.00} reduceMotion={reduceMotion} className="block">
                Securely delivered<Period />
              </Reveal>

              <Reveal as="span" delay={3.70} reduceMotion={reduceMotion} className="block">
                Forever treasured<Period />
              </Reveal>
            </h1>

            <Reveal
              as="p"
              delay={5.20}
              duration={0.9}
              reduceMotion={reduceMotion}
              className="mt-8 sm:mt-10 mx-auto sm:mx-0 max-w-md sm:max-w-lg text-sm sm:text-base leading-relaxed"
            >
              <span style={{ color: 'rgba(255,255,255,0.55)' }}>
                Each piece is hand-painted in our Hyderabad studio.
              </span>
            </Reveal>

            <Reveal
              as="div"
              delay={5.60}
              duration={0.9}
              reduceMotion={reduceMotion}
              className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-stretch sm:items-center
                         justify-center sm:justify-start gap-3 sm:gap-4"
            >
              <Link
                href="/shop"
                className="btn-glow-gold min-w-0 sm:min-w-[15rem] justify-center"
              >
                Explore Collections
                <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
              <Link
                href="/custom-order"
                className="btn-glow-gold-outline justify-center"
              >
                Order a custom piece
                <ArrowRight className="w-3.5 h-3.5" aria-hidden />
              </Link>
            </Reveal>
          </div>
        </div>
      </div>

      {/* Bottom social row. Centred on mobile (the centred composition
          continues), pinned to the bottom-left from sm up. */}
      <Reveal
        as="div"
        delay={6.00}
        duration={0.9}
        reduceMotion={reduceMotion}
        className="absolute bottom-6 sm:bottom-8 inset-x-0 sm:inset-x-auto sm:left-8 lg:left-16 z-[2]
                   flex items-center justify-center sm:justify-start gap-3 sm:gap-5
                   text-[10px] sm:text-[11px] uppercase font-medium"
      >
        <span aria-label="Follow Srilatha Art" className="sr-only">
          Follow Srilatha Art
        </span>
        <a
          href="https://wa.me/919133266754"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors duration-300 hover:text-white"
          style={{ letterSpacing: '0.18em', color: 'rgba(255,255,255,0.45)' }}
        >
          WhatsApp
        </a>
        <span
          className="w-1 h-1 rounded-full"
          style={{ background: 'rgba(255,255,255,0.30)' }}
          aria-hidden
        />
        <a
          href="https://instagram.com/srilatha_arts"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors duration-300 hover:text-white"
          style={{ letterSpacing: '0.18em', color: 'rgba(255,255,255,0.45)' }}
        >
          Instagram
        </a>
        <span
          className="w-1 h-1 rounded-full"
          style={{ background: 'rgba(255,255,255,0.30)' }}
          aria-hidden
        />
        <span
          className="hidden sm:inline"
          style={{ letterSpacing: '0.18em', color: 'rgba(255,255,255,0.30)' }}
        >
          Painting since 2020
        </span>
      </Reveal>
    </section>
  )
}
