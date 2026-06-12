'use client'
import Link from 'next/link'
import { ArrowRight, Sparkles, MessageSquare, Palette, Box } from 'lucide-react'
import { motion } from 'framer-motion'
import { fadeUp, stagger } from '@/lib/motion'

const steps = [
  {
    step: '01',
    title: 'Share Your Idea',
    description: 'Select your preferred art style, choose a custom color palette, and specify the dimensions to fit your space perfectly.',
    icon: MessageSquare,
  },
  {
    step: '02',
    title: 'Design Consultation',
    description: 'Directly collaborate with Srilatha to finalize design details, mirror layout symmetries, or resin layer depths.',
    icon: Palette,
  },
  {
    step: '03',
    title: 'Craft & Delivery',
    description: 'We meticulously hand-paint or hand-pour your masterpiece in our Hyderabad studio, and deliver in shockproof crates.',
    icon: Box,
  },
] as const

export default function CustomOrderCTA() {
  return (
    <section className="px-5 lg:px-8 py-16 sm:py-24 lg:py-32 max-w-7xl mx-auto">
      <div className="relative overflow-hidden p-8 sm:p-12 lg:p-20 border border-white/20 rounded-4xl"
        style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)' }}>
        {/* Glossy top sheen */}
        <div className="absolute inset-x-0 top-0 h-[40%] pointer-events-none"
          style={{ background: 'linear-gradient(180deg,rgba(255,255,255,0.14) 0%,transparent 100%)' }} />

        <div className="relative z-10 text-center max-w-4xl mx-auto">
          <span className="eyebrow text-lavender justify-center mb-5">
            <Sparkles className="w-3.5 h-3.5" aria-hidden />
            Bespoke Commission
            <Sparkles className="w-3.5 h-3.5" aria-hidden />
          </span>
          <h2 className="display text-4xl sm:text-5xl lg:text-7xl mb-6 uppercase text-white">
            Tailored Just For You.
            <br />
            <em className="italic" style={{ color: 'var(--accent)' }}>Start A Custom Design</em>
          </h2>
          <p className="text-white/80 text-lg lg:text-xl leading-relaxed max-w-2xl mx-auto mb-16 font-normal">
            Lippan wedding pieces, Resin home decor trays, or a handmade gift set for someone special.
            Share your idea and we will guide you through every step of the handmade process.
          </p>

          {/* 3-Step Process Flow */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-20px' }}
            variants={stagger}
            className="relative grid grid-cols-1 md:grid-cols-3 gap-8 text-left mb-16"
          >
            {/* Desktop connecting rule */}
            <div
              aria-hidden
              className="hidden md:block absolute top-12 left-[16.6%] right-[16.6%] h-px z-0"
              style={{
                background:
                  'linear-gradient(to right, transparent, rgba(176,110,232,0.70) 20%, rgba(251,191,36,0.70) 50%, rgba(176,110,232,0.70) 80%, transparent)',
              }}
            />
            {steps.map((s) => {
              const Icon = s.icon
              return (
                <motion.div
                  key={s.step}
                  variants={fadeUp}
                  className="relative z-10 p-6 sm:p-8 flex flex-col justify-between"
                  style={{
                    background: 'rgba(61,26,104,0.85)',
                    border: '1px solid rgba(255,255,255,0.22)',
                    borderRadius: '24px',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22), 0 16px 40px rgba(0,0,0,0.35)',
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <span
                        className="font-serif text-6xl leading-none gold-text"
                        aria-hidden
                      >
                        {s.step}
                      </span>
                      <span className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ background: 'rgba(176,110,232,0.25)', border: '1px solid rgba(176,110,232,0.45)', color: 'var(--brand)' }}>
                        <Icon className="w-5 h-5" />
                      </span>
                    </div>
                    <h3 className="font-sans text-xl font-semibold tracking-wide text-white mb-3 uppercase">
                      {s.title}
                    </h3>
                    <p className="text-white/75 text-sm lg:text-base leading-relaxed font-normal">
                      {s.description}
                    </p>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>

          <Link
            href="/custom-order"
            className="btn-dark inline-flex uppercase tracking-widest font-semibold text-sm px-10 py-4 shadow-lg hover:shadow-xl"
          >
            Request Custom Design
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>

      </div>
    </section>
  )
}
