'use client'
/**
 * HomeHero — AndroAI dark variant.
 *
 * Dark slate canvas with aurora gradient (blue/indigo/cyan radials),
 * large Plus Jakarta Sans display headline with gradient accent word,
 * dual neon-glow CTAs, trust strip, floating showcase chip + stat
 * cards on desktop.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ArrowRight, Sparkles, Star } from 'lucide-react'
import { FreeShippingThreshold } from '@/components/ShippingFigures'

const EASE_LUXURY = [0.22, 1, 0.36, 1] as const

export default function HomeHero() {
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduceMotion(mql.matches)
    const onChange = (e: MediaQueryListEvent) => setReduceMotion(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  const fade = (delay: number) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 24 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.9, delay, ease: EASE_LUXURY },
        }

  return (
    <section
      aria-label="Welcome to Srilatha Art"
      className="relative w-full overflow-hidden bg-plum"
      style={{ minHeight: '100svh' }}
    >
      {/* Aurora gradient on dark canvas */}
      <div
        aria-hidden
        className="absolute inset-0 bg-hero-aurora animate-gradient-shift"
        style={{ backgroundSize: '200% 200%' }}
      />

      {/* Floating glow orbs */}
      <div
        aria-hidden
        className="hidden md:block absolute -top-32 -right-24 w-[480px] h-[480px] rounded-full
                   bg-gradient-to-br from-blue/40 via-indigo/25 to-transparent
                   blur-3xl animate-float-slow"
      />
      <div
        aria-hidden
        className="hidden md:block absolute -bottom-40 -left-20 w-[520px] h-[520px] rounded-full
                   bg-gradient-to-tr from-cyan/25 via-blue/20 to-transparent
                   blur-3xl animate-float"
      />

      {/* Dot grid */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.40]"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(59,130,246,0.20) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, black 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, black 30%, transparent 80%)',
        }}
      />

      <div className="relative z-10 flex items-center" style={{ minHeight: '100svh' }}>
        <div className="w-full max-w-container mx-auto px-5 sm:px-8 lg:px-12 pt-28 sm:pt-32 pb-24">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-center">

            {/* Left — copy block */}
            <div className="lg:col-span-7 text-center lg:text-left">
              <motion.div {...fade(0.05)}>
                <span className="inline-flex items-center gap-2 h-8 px-3.5
                                 rounded-full bg-blue/10 backdrop-blur
                                 border border-blue/30 text-[12px] font-semibold
                                 text-blue tracking-[0.10em] uppercase
                                 shadow-[0_0_18px_rgba(59,130,246,0.30)]">
                  <Sparkles className="w-3.5 h-3.5" aria-hidden />
                  Handcrafted Resin Art
                </span>
              </motion.div>

              <motion.h1
                {...fade(0.15)}
                className="font-display mt-6 sm:mt-7
                           text-[2.75rem] sm:text-[3.75rem] lg:text-[4.5rem] xl:text-[5.25rem]
                           leading-[1.02] tracking-tightest text-ivory"
              >
                Transforming{' '}
                <span className="relative inline-block">
                  <span className="bg-gradient-to-r from-blue via-indigo to-cyan bg-clip-text text-transparent
                                   drop-shadow-[0_0_20px_rgba(59,130,246,0.45)]">
                    memories
                  </span>
                  <span
                    aria-hidden
                    className="absolute -bottom-1 left-0 right-0 h-1.5 rounded-full
                               bg-gradient-to-r from-blue/55 via-indigo/55 to-cyan/55 blur-sm"
                  />
                </span>{' '}
                into timeless artwork.
              </motion.h1>

              <motion.p
                {...fade(0.30)}
                className="mt-6 lg:mt-7 max-w-xl mx-auto lg:mx-0
                           text-base sm:text-lg text-ivory-soft leading-relaxed"
              >
                Custom resin creations crafted with precision, creativity and passion —
                hand-painted in our Hyderabad studio and shipped securely across India.
              </motion.p>

              <motion.div
                {...fade(0.45)}
                className="mt-9 lg:mt-10 flex flex-col sm:flex-row items-stretch sm:items-center
                           justify-center lg:justify-start gap-3 sm:gap-4"
              >
                <Link href="/shop" className="btn-dark !min-h-10 !px-6 !text-[14px] sm:min-w-[12.5rem] justify-center group">
                  Shop Collection
                  <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
                </Link>
                <Link href="/custom-order" className="btn-outline !min-h-10 !px-6 !text-[14px] sm:min-w-[12.5rem] justify-center group">
                  Custom Orders
                  <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
                </Link>
              </motion.div>

              {/* Trust strip */}
              <motion.div
                {...fade(0.60)}
                className="mt-10 lg:mt-12 flex flex-wrap items-center justify-center lg:justify-start
                           gap-x-6 gap-y-2 text-sm text-ivory-mute"
              >
                <span className="flex items-center gap-1.5">
                  <Star className="w-4 h-4 fill-blue text-blue" aria-hidden />
                  <strong className="text-ivory font-semibold">4.9</strong>
                  <span>Customer rating</span>
                </span>
                <span className="hidden sm:inline w-1 h-1 rounded-full bg-ivory-mute/50" aria-hidden />
                <span>
                  <strong className="text-ivory font-semibold">100+</strong> pieces shipped
                </span>
                <span className="hidden sm:inline w-1 h-1 rounded-full bg-ivory-mute/50" aria-hidden />
                <span>Free shipping above <FreeShippingThreshold /></span>
              </motion.div>
            </div>

            {/* Right — floating showcase card (desktop only) */}
            <motion.div
              {...fade(0.30)}
              className="hidden lg:block lg:col-span-5 relative"
            >
              <div className="relative aspect-[4/5] max-w-md mx-auto">
                {/* Glow halo */}
                <div
                  aria-hidden
                  className="absolute -inset-6 rounded-[36px]
                             bg-gradient-to-br from-blue/40 via-indigo/25 to-cyan/20
                             blur-3xl"
                />
                <div className="relative h-full w-full rounded-[28px] overflow-hidden
                                bg-plum-light border border-white/10 shadow-card-hover">
                  <Image
                    src="/Logos/og-cover.jpg"
                    alt="Featured artwork from the Srilatha Art studio"
                    fill
                    sizes="(min-width: 1024px) 420px, 100vw"
                    priority
                    className="object-cover"
                  />
                  <div className="absolute inset-x-3 bottom-3 rounded-2xl
                                  bg-slate-950/75 backdrop-blur-xl
                                  border border-white/10 px-4 py-3 shadow-card">
                    <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-blue">
                      Featured
                    </p>
                    <p className="font-display text-base text-ivory mt-0.5">
                      Vermilion Tide — Resin Mandala
                    </p>
                  </div>
                </div>

                {/* Floating stat cards */}
                <div className="absolute -left-6 top-12 lg:top-20 rounded-2xl
                                bg-plum-light/95 backdrop-blur border border-white/10 shadow-card
                                px-4 py-3 flex items-center gap-3 animate-float">
                  <span className="grid place-items-center w-9 h-9 rounded-full
                                   bg-blue/15 text-blue border border-blue/30
                                   shadow-[0_0_14px_rgba(59,130,246,0.40)]">
                    <Sparkles className="w-4 h-4" aria-hidden />
                  </span>
                  <div>
                    <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-ivory-mute">
                      Handcrafted
                    </p>
                    <p className="text-sm font-semibold text-ivory">in Hyderabad</p>
                  </div>
                </div>

                <div className="absolute -right-4 bottom-16 rounded-2xl
                                bg-plum-light/95 backdrop-blur border border-white/10 shadow-card
                                px-4 py-3 flex items-center gap-3 animate-float-slow">
                  <span className="grid place-items-center w-9 h-9 rounded-full
                                   bg-gradient-to-br from-blue to-indigo text-white
                                   shadow-[0_0_16px_rgba(59,130,246,0.55)]">
                    <Star className="w-4 h-4 fill-current" aria-hidden />
                  </span>
                  <div>
                    <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-ivory-mute">
                      Reviews
                    </p>
                    <p className="text-sm font-semibold text-ivory">4.9 / 5 stars</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}
