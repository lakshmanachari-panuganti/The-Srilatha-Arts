'use client'
import Link from 'next/link'
import { ArrowRight, Sparkles, MessageSquare, Palette, Box, MessageCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { fadeUp, stagger } from '@/lib/motion'
import { waLink } from '@/lib/site-config'

const steps = [
  {
    step: '01',
    title: 'Share your idea',
    description:
      'Pick an art form, share a colour palette, and tell us the dimensions that suit your space.',
    icon: MessageSquare,
  },
  {
    step: '02',
    title: 'Design consultation',
    description:
      'Collaborate directly with Srilatha on layout, symmetry, resin depths and finishing details.',
    icon: Palette,
  },
  {
    step: '03',
    title: 'Craft & delivery',
    description:
      'Your piece is hand-poured in our Hyderabad studio and dispatched in shockproof crates.',
    icon: Box,
  },
] as const

export default function CustomOrderCTA() {
  return (
    <section className="px-5 lg:px-8 py-20 sm:py-24 lg:py-32 max-w-container mx-auto">
      <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-plum-warm/70 backdrop-blur-xl shadow-card">
        {/* Aurora wash in the panel */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-90"
          style={{
            background:
              'radial-gradient(60% 50% at 0% 0%, rgba(59,130,246,0.22), transparent 60%), radial-gradient(50% 40% at 100% 100%, rgba(129,140,248,0.20), transparent 60%), radial-gradient(40% 30% at 50% 50%, rgba(34,211,238,0.10), transparent 60%)',
          }}
        />

        <div className="relative p-8 sm:p-12 lg:p-16">
          <div className="text-center max-w-3xl mx-auto">
            <span className="inline-flex items-center gap-2 px-3.5 h-8 rounded-full
                             bg-blue/10 border border-blue/30
                             text-[12px] font-semibold text-blue tracking-[0.10em] uppercase mb-5
                             shadow-[0_0_18px_rgba(59,130,246,0.25)]">
              <Sparkles className="w-3.5 h-3.5" aria-hidden />
              Custom Design
            </span>
            <h2 className="font-display text-3xl sm:text-5xl lg:text-6xl text-ivory tracking-tightest leading-[1.05]">
              Tailored just for you.{' '}
              <span className="bg-gradient-to-r from-blue via-indigo to-cyan bg-clip-text text-transparent
                               drop-shadow-[0_0_20px_rgba(59,130,246,0.45)]">
                Start a custom design.
              </span>
            </h2>
            <p className="mt-5 lg:mt-6 text-ivory-soft text-base lg:text-lg leading-relaxed max-w-2xl mx-auto">
              Lippan wedding pieces, resin home decor trays, or a handmade gift set for someone special —
              share your idea and we will guide you through every step of the handmade process.
            </p>
          </div>

          {/* 3-step process */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            variants={stagger}
            className="relative grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-7 mt-14 lg:mt-16"
          >
            <div
              aria-hidden
              className="hidden md:block absolute top-12 left-[16.6%] right-[16.6%] h-px z-0"
              style={{
                background:
                  'linear-gradient(to right, transparent, rgba(59,130,246,0.55) 20%, rgba(129,140,248,0.65) 50%, rgba(59,130,246,0.55) 80%, transparent)',
              }}
            />
            {steps.map((s) => {
              const Icon = s.icon
              return (
                <motion.div
                  key={s.step}
                  variants={fadeUp}
                  className="relative z-10 p-6 sm:p-7 rounded-2xl
                             bg-plum-light/80 backdrop-blur border border-white/10 shadow-card
                             hover:shadow-card-hover hover:-translate-y-1 hover:border-blue/30
                             transition-all duration-300"
                >
                  <div className="flex items-center justify-between mb-5">
                    <span
                      aria-hidden
                      className="font-display text-5xl leading-none font-extrabold
                                 bg-gradient-to-br from-blue via-indigo to-cyan bg-clip-text text-transparent
                                 drop-shadow-[0_0_20px_rgba(59,130,246,0.45)]"
                    >
                      {s.step}
                    </span>
                    <span className="grid place-items-center w-11 h-11 rounded-full
                                     bg-blue/15 text-blue border border-blue/30
                                     shadow-[0_0_14px_rgba(59,130,246,0.30)]">
                      <Icon className="w-5 h-5" aria-hidden />
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-bold text-ivory mb-2 tracking-tight">
                    {s.title}
                  </h3>
                  <p className="text-ivory-soft text-sm lg:text-[15px] leading-relaxed">
                    {s.description}
                  </p>
                </motion.div>
              )
            })}
          </motion.div>

          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/custom-order" className="btn-dark min-w-[14rem] justify-center group">
              Order Custom Design
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
            </Link>
            <a
              href={waLink('Hi Srilatha Art, I would like a custom piece.')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 min-w-[14rem] h-[2.875rem] px-6
                         rounded-full font-semibold text-white
                         bg-[#25D366] hover:bg-[#1ebe5b]
                         shadow-[0_0_24px_rgba(37,211,102,0.45)] hover:shadow-[0_0_36px_rgba(37,211,102,0.65)]
                         transition-all duration-300"
            >
              <MessageCircle className="w-4 h-4" aria-hidden />
              Chat on WhatsApp
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
