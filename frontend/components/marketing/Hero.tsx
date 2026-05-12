'use client'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Soft decorative blobs */}
      <div
        aria-hidden
        className="absolute -top-32 -right-24 w-[420px] h-[420px] rounded-full
                   bg-gradient-to-br from-clay/25 via-gold-light/20 to-transparent blur-3xl"
      />
      <div
        aria-hidden
        className="absolute top-1/3 -left-32 w-[360px] h-[360px] rounded-full
                   bg-gradient-to-br from-sage/15 via-cream-deep to-transparent blur-3xl"
      />

      <div className="relative max-w-5xl mx-auto px-5 lg:px-8 pt-10 lg:pt-16 pb-16 lg:pb-24 text-center">
        {/* Eyebrow */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="eyebrow justify-center mb-6"
        >
          <span className="w-6 h-px bg-terracotta" />
          Hyderabad · est. 2020
          <span className="w-6 h-px bg-terracotta" />
        </motion.p>

        {/* Big round monogram */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
          className="relative mb-6 lg:mb-8"
        >
          <Image
            src="/images/logo.png"
            alt="The Srilatha Arts monogram"
            width={240}
            height={240}
            priority
            className="w-32 sm:w-40 lg:w-52 h-auto mx-auto drop-shadow-[0_8px_24px_rgba(184,148,31,0.25)] animate-float"
          />
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.32, 0.72, 0, 1] }}
          className="display text-5xl sm:text-6xl lg:text-8xl mb-5 lg:mb-7"
        >
          Where Tradition
          <br />
          Meets{' '}
          <span className="relative italic font-serif">
            Creativity
            <svg
              viewBox="0 0 200 12"
              preserveAspectRatio="none"
              className="absolute -bottom-2 left-0 w-full h-3 text-terracotta"
              aria-hidden
            >
              <path
                d="M2 8 Q 50 2, 100 6 T 198 5"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </motion.h1>

        {/* Subhead */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-ink-soft text-base lg:text-lg max-w-reader mx-auto mb-8 lg:mb-10 leading-relaxed"
        >
          A small studio crafting Resin, Dot Mandala, Lippan, Pichwai and Kolam art — by hand, one
          piece at a time, for homes across India.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-3 justify-center mb-12"
        >
          <Link href="/shop" className="btn-dark">
            Explore the collection
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
          <Link href="/custom-order" className="btn-outline">
            Commission a piece
          </Link>
        </motion.div>

        {/* Trust strip — short, editorial */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] tracking-[0.18em] uppercase text-ink-mute"
        >
          <span>Free shipping ₹2,999+</span>
          <span className="w-1 h-1 rounded-full bg-ink-mute/40" aria-hidden />
          <span>Handmade in Hyderabad</span>
          <span className="w-1 h-1 rounded-full bg-ink-mute/40" aria-hidden />
          <span>Ships in 5–7 days</span>
        </motion.div>
      </div>
    </section>
  )
}
