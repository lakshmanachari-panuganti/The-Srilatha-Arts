'use client'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

// Hero is intentionally LIGHTER than before. The visual hero job is now done
// by <HeroSlideshow /> above this component; Hero is the brand-voice block
// that turns the carousel's visual impact into a value proposition. The
// "MADE IN HYDERABAD · SINCE 2020" eyebrow and the big circular SA monogram
// + wordmark were removed deliberately — keep them gone unless the slideshow
// goes away.

export default function Hero() {
  return (
    <section className="relative overflow-hidden flex items-center py-12 sm:py-16 lg:py-24">
      {/* Single ambient glow — the slideshow above provides all the visual
          decoration this hero needs, so the previous 3-orb + mandala setup
          (which existed to halo the monogram) has been removed. */}
      <div
        aria-hidden
        className="absolute -top-20 left-1/2 -translate-x-1/2 w-[400px] h-[280px] rounded-full
                   bg-gradient-to-br from-lavender-pastel/10 to-transparent blur-[80px]"
      />

      <div className="relative max-w-5xl mx-auto px-5 lg:px-8 text-center z-10">
        {/* Headline. No eyebrow + no monogram here — the slideshow above
            already establishes the brand visually. The headline is the
            brand promise that turns the visual impact into intent. */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="display text-4xl sm:text-5xl lg:text-7xl mb-5 lg:mb-7"
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
          Beautiful handcrafted art in five styles — Resin, Dot Mandala, Lippan, Kolam and
          Wedding Decoratives. Each piece is made by hand, one at a time, in our Hyderabad studio.
        </motion.p>

        {/*
          CTA hierarchy. Previous design had two equal-weight buttons side
          by side — "Shop all art" filled and "Order a custom piece"
          outlined. Equal visual weight = no decision made for the user
          (audit §3). Now: Shop all art is the dominant action (filled,
          full-width on mobile). Custom orders becomes a quieter text
          link below — still discoverable but not competing.
        */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.45 }}
          className="flex flex-col items-center gap-3 mb-12"
        >
          <Link href="/shop" className="btn-dark w-full sm:w-auto sm:min-w-[18rem] justify-center">
            Shop all art
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
          <Link
            href="/custom-order"
            className="text-sm text-ivory-soft hover:text-lavender-pastel transition-colors duration-300 inline-flex items-center gap-1 underline-offset-4 hover:underline"
          >
            Or order a custom piece
            <ArrowRight className="w-3.5 h-3.5" aria-hidden />
          </Link>
        </motion.div>

        {/*
          By-the-numbers trust strip — concrete signals beat adjectives
          (audit §3). One real number ("Painting since 2020") anchors the
          claim; the other two are verifiable service promises. Replace
          "Painting since 2020" with shipped-count + review-rating once
          the studio has the data ("1,200+ shipped", "★ 4.9 from 340
          reviews").
        */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.7 }}
          className="flex flex-col sm:flex-row sm:flex-wrap items-center justify-center
                     gap-y-2 sm:gap-x-6 text-[11px] uppercase text-ivory-mute"
          style={{ letterSpacing: '0.12em' }}
        >
          <span>Painting since 2020</span>
          <span className="hidden sm:inline w-1 h-1 rounded-full bg-lavender-soft/40" aria-hidden />
          <span>Free shipping above ₹2,999</span>
          <span className="hidden sm:inline w-1 h-1 rounded-full bg-lavender-soft/40" aria-hidden />
          <span>7-day easy returns</span>
        </motion.div>
      </div>
    </section>
  )
}
