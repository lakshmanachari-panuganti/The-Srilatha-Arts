'use client'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

export default function Hero() {
  return (
    <section className="relative overflow-hidden min-h-[90vh] flex items-center">
      {/* Dreamy ambient glow orbs */}
      <div
        aria-hidden
        className="absolute -top-40 -right-32 w-[500px] h-[500px] rounded-full
                   bg-gradient-to-br from-lavender-soft/20 via-lavender-pastel/15 to-transparent blur-[100px]
                   animate-glow-pulse"
      />
      <div
        aria-hidden
        className="absolute top-1/2 -left-40 w-[400px] h-[400px] rounded-full
                   bg-gradient-to-br from-lavender/15 via-plum-warm to-transparent blur-[80px]
                   animate-glow-pulse [animation-delay:2s]"
      />
      <div
        aria-hidden
        className="absolute bottom-10 right-1/4 w-[300px] h-[300px] rounded-full
                   bg-gradient-to-br from-lavender-pastel/10 to-transparent blur-[60px]
                   animate-glow-pulse [animation-delay:3s]"
      />

      {/* Subtle mandala-inspired decorative circle */}
      <div
        aria-hidden
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] lg:w-[800px] lg:h-[800px]
                   opacity-[0.04] animate-gentle-rotate"
      >
        <svg viewBox="0 0 800 800" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <circle cx="400" cy="400" r="380" stroke="#C8B6FF" strokeWidth="0.5" strokeDasharray="8 12" />
          <circle cx="400" cy="400" r="300" stroke="#C8B6FF" strokeWidth="0.5" strokeDasharray="4 8" />
          <circle cx="400" cy="400" r="220" stroke="#C8B6FF" strokeWidth="0.5" strokeDasharray="3 6" />
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i / 12) * Math.PI * 2
            const x = 400 + Math.cos(angle) * 340
            const y = 400 + Math.sin(angle) * 340
            return <circle key={i} cx={x} cy={y} r="4" fill="#C8B6FF" />
          })}
          {Array.from({ length: 8 }).map((_, i) => {
            const angle = (i / 8) * Math.PI * 2
            const x = 400 + Math.cos(angle) * 260
            const y = 400 + Math.sin(angle) * 260
            return <circle key={`inner-${i}`} cx={x} cy={y} r="3" fill="#8A74C9" />
          })}
        </svg>
      </div>

      <div className="relative max-w-5xl mx-auto px-5 lg:px-8 pt-10 lg:pt-16 pb-16 lg:pb-24 text-center z-10">
        {/* Eyebrow */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="eyebrow justify-center mb-6"
        >
          <span className="w-8 h-px bg-gradient-to-r from-transparent to-lavender-pastel" />
          Made in Hyderabad · since 2020
          <span className="w-8 h-px bg-gradient-to-l from-transparent to-lavender-pastel" />
        </motion.p>

        {/* Big round monogram with glow */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="relative mb-8 lg:mb-10"
        >
          <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
            <div className="w-40 sm:w-48 lg:w-64 h-40 sm:h-48 lg:h-64 rounded-full
                            bg-lavender-soft/15 blur-[40px] animate-glow-pulse" />
          </div>
          <Image
            src="/images/logo.png"
            alt="Srilatha Art monogram"
            width={240}
            height={240}
            priority
            className="relative w-32 sm:w-40 lg:w-52 h-auto mx-auto
                       drop-shadow-[0_8px_32px_rgba(138,116,201,0.3)] animate-float"
          />
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="display text-5xl sm:text-6xl lg:text-8xl mb-5 lg:mb-7"
        >
          Handmade Indian
          <br />
          art for your{' '}
          <span className="relative italic font-serif">
            <span className="gold-text">home</span>
            <svg
              viewBox="0 0 200 12"
              preserveAspectRatio="none"
              className="absolute -bottom-2 left-0 w-full h-3 text-lavender-soft"
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
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="text-ivory-soft text-base lg:text-lg max-w-reader mx-auto mb-8 lg:mb-10 leading-relaxed"
        >
          Beautiful wall art in five styles — Resin, Dot Mandala, Lippan, Pichwai and Kolam.
          Each piece is made by hand, one at a time, in our Hyderabad studio.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.45 }}
          className="flex flex-col sm:flex-row gap-3 justify-center mb-14"
        >
          <Link href="/shop" className="btn-dark">
            Shop all art
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
          <Link href="/custom-order" className="btn-outline">
            Order a custom piece
          </Link>
        </motion.div>

        {/* Trust strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.7 }}
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] tracking-[0.18em] uppercase text-ivory-mute"
        >
          <span>Free shipping above ₹2,999</span>
          <span className="w-1 h-1 rounded-full bg-lavender-soft/40" aria-hidden />
          <span>Made by hand in Hyderabad</span>
          <span className="w-1 h-1 rounded-full bg-lavender-soft/40" aria-hidden />
          <span>Delivered in 5–7 days</span>
        </motion.div>
      </div>
    </section>
  )
}
