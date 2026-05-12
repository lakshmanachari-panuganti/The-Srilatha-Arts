'use client'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ArrowRight, Sparkles } from 'lucide-react'

export default function Hero() {
  return (
    <section className="relative min-h-svh flex flex-col justify-end overflow-hidden -mt-[calc(var(--banner-h)+3.5rem)] lg:-mt-[calc(var(--banner-h)+4rem)] pt-[calc(var(--banner-h)+3.5rem)] lg:pt-[calc(var(--banner-h)+4rem)]">
      {/* Full-bleed art */}
      <div className="absolute inset-0">
        <Image
          src="/images/logo-round.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-30 mix-blend-screen scale-[1.3]"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary-dark via-primary-burnt/40 to-ink" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-primary-dark/40 to-transparent" />
        {/* Decorative kolam dots */}
        <svg
          viewBox="0 0 600 800"
          className="absolute inset-0 w-full h-full text-gold/15"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden
        >
          {Array.from({ length: 60 }).map((_, i) => {
            const r = 200 + (i % 5) * 60
            const t = (i / 60) * Math.PI * 2
            const x = 300 + Math.cos(t) * r
            const y = 400 + Math.sin(t) * r * 0.8
            return <circle key={i} cx={x} cy={y} r={1.5} fill="currentColor" />
          })}
        </svg>
      </div>

      {/* Copy */}
      <div className="relative z-10 px-5 pb-12 pt-24 lg:px-12 lg:pb-20 lg:pt-32 max-w-7xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
          className="max-w-md lg:max-w-2xl"
        >
          <p className="flex items-center gap-2 text-gold-light/85 text-[11px] tracking-[0.3em] uppercase mb-4">
            <Sparkles className="w-3 h-3" aria-hidden />
            Hyderabad · Handcrafted with love
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl
                         font-semibold text-cream leading-[1.05] mb-5">
            Where Tradition
            <br />
            Meets <span className="gold-text font-bold">Creativity</span>
          </h1>
          <p className="text-cream/75 text-base lg:text-lg mb-7 leading-relaxed max-w-lg">
            Bespoke Dot Mandala, Resin, Lippan, Pichwai and Kolam art — handcrafted to bring quiet
            beauty into your space.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/shop" className="btn-gold">
              Explore the collection
              <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
            <Link href="/custom-order" className="btn-outline border-cream/30 text-cream">
              Commission a piece
            </Link>
          </div>
        </motion.div>
      </div>

      {/* Scroll affordance */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.6 }}
        className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 hidden sm:flex flex-col items-center gap-2 text-cream/40 text-[10px] tracking-[0.3em] uppercase"
        aria-hidden
      >
        Scroll
        <span className="w-px h-8 bg-gradient-to-b from-cream/40 to-transparent animate-pulse" />
      </motion.div>
    </section>
  )
}
