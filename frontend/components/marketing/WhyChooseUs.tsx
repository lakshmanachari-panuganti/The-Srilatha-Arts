'use client'
import { Check, ShieldCheck, HeartHandshake, PackageCheck, Paintbrush, Hammer, Sparkles, Layers } from 'lucide-react'
import { motion } from 'framer-motion'
import { fadeUp, stagger } from '@/lib/motion'

const differentiators = [
  {
    title: '100% Handcrafted',
    description: 'We do not mass-produce. Every paint dot is placed individually, and every color is custom mixed, creating true collector pieces.',
    icon: Paintbrush,
  },
  {
    title: 'Premium Materials',
    description: 'Gallery-grade birch plywood and non-toxic, crystal-clear artists resin guarantee beautiful durability that lasts generations.',
    icon: ShieldCheck,
  },
  {
    title: 'Custom Design Expertise',
    description: 'Direct communication with Srilatha to customize art dimensions, mirror symmetries, or custom color boards to match your space.',
    icon: HeartHandshake,
  },
  {
    title: 'Shockproof Wooden Crates',
    description: 'Custom-built wooden shockproof packaging ensures your luxury artwork arrives in absolutely perfect, pristine condition.',
    icon: PackageCheck,
  },
] as const

const processSteps = [
  {
    step: 'I',
    title: 'Sketch & Grid Layout',
    description: 'Geometric mandala grids or traditional Lippan mud lines are sketched on dense, gallery-grade wood panels.',
    icon: Paintbrush,
  },
  {
    step: 'II',
    title: 'Bespoke Detailing',
    description: 'Placing shimmering glass mirrors or hand-painting thousands of high-contrast dot mandalas one dot at a time.',
    icon: Hammer,
  },
  {
    step: 'III',
    title: 'Layering & Polishing',
    description: 'Eco-certified liquid resin is layered and blowtorched to capture depth and create a smooth glass-like finish.',
    icon: Layers,
  },
  {
    step: 'IV',
    title: 'Curing & Packaging',
    description: 'The pieces cure in a dust-free, temperature-stable room for 72 hours before being secured in shockproof custom crates.',
    icon: PackageCheck,
  },
] as const

export default function WhyChooseUs() {
  return (
    <section className="px-5 lg:px-8 py-16 sm:py-24 lg:py-32 max-w-7xl mx-auto border-t border-glass-border/30">
      <div className="grid md:grid-cols-12 gap-12 lg:gap-16 items-start mb-24">
        {/* Left Side: Why Choose Us */}
        <div className="md:col-span-5 md:sticky md:top-36">
          <span className="eyebrow text-lavender mb-4">Our Quality Promise</span>
          <h2 className="display text-4xl sm:text-5xl lg:text-7xl mb-6 uppercase">
            Why Choose <br />
            <em className="italic text-lavender-pastel">Srilatha Art</em>
          </h2>
          <p className="text-ivory-soft text-lg leading-relaxed mb-8 font-normal">
            We believe that premium home decor should tell a story of dedication, authenticity, and unparalleled craft.
            Every creation is treated as a unique masterwork, built from high-grade raw components and handled with exceptional care.
          </p>
          <div className="card p-6">
            <p className="text-sm font-semibold tracking-wider uppercase text-ivory mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4" style={{ color: 'var(--accent-gold)' }} /> Shipping Guarantee
            </p>
            <p className="text-ivory-soft text-sm leading-relaxed font-normal">
              Any damage in transit is fully covered. We will immediately replace or refund any piece that does not arrive perfectly.
            </p>
          </div>
        </div>

        {/* Right Side: Grid cards */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-20px' }}
          variants={stagger}
          className="md:col-span-7 grid sm:grid-cols-2 gap-6"
        >
          {differentiators.map((diff) => {
            const Icon = diff.icon
            return (
              <motion.div
                key={diff.title}
                variants={fadeUp}
                className="card relative p-6 pl-7 flex flex-col gap-4 transition-all duration-300"
              >
                {/* Left-accent rail in cyber gold, sitting under the card's
                    overflow-hidden so it bleeds into the radius cleanly. */}
                <span
                  aria-hidden
                  className="absolute left-0 top-0 bottom-0 w-1"
                  style={{
                    background:
                      'linear-gradient(180deg, #fef3c7 0%, #facc15 50%, #eab308 100%)',
                  }}
                />
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{
                    background: 'rgba(250,204,21,0.08)',
                    border: '1px solid rgba(250,204,21,0.25)',
                    color: 'var(--accent-gold)',
                  }}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-sans text-lg font-semibold tracking-wide text-ivory mb-2 uppercase">
                    {diff.title}
                  </h3>
                  <p className="text-ivory-soft text-sm lg:text-base leading-relaxed font-normal">
                    {diff.description}
                  </p>
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      </div>

      {/* Handmade Process Section */}
      <div className="border-t border-glass-border/30 pt-16 sm:pt-24 lg:pt-32">
        <div className="text-center max-w-3xl mx-auto mb-16 lg:mb-24">
          <span className="eyebrow text-lavender justify-center mb-4">Behind the Scenes</span>
          <h2 className="display text-4xl sm:text-5xl lg:text-7xl mb-6 uppercase">
            The Handmade <em className="italic text-lavender-pastel">Process</em>
          </h2>
          <p className="text-ivory-soft text-lg lg:text-xl leading-relaxed font-normal">
            Take a glimpse into the slow, careful stages of how our handcrafted home decor comes to life.
          </p>
        </div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-20px' }}
          variants={stagger}
          className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8"
        >
          {/* Desktop-only connecting gold rule behind the 4-card row. Same
              pattern as CustomOrderCTA but spanning 4 columns. */}
          <div
            aria-hidden
            className="hidden lg:block absolute top-14 left-[12.5%] right-[12.5%] h-px z-0"
            style={{
              background:
                'linear-gradient(to right, transparent, rgba(250,204,21,0.40) 18%, rgba(250,204,21,0.40) 82%, transparent)',
            }}
          />
          {processSteps.map((step) => {
            return (
              <motion.div
                key={step.step}
                variants={fadeUp}
                className="card relative z-10 p-6 sm:p-8 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span
                      className="font-serif text-5xl leading-none gold-text"
                      aria-hidden
                    >
                      {step.step}
                    </span>
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{
                        background: 'rgba(250,204,21,0.08)',
                        border: '1px solid rgba(250,204,21,0.25)',
                        color: 'var(--accent-gold)',
                      }}
                    >
                      <step.icon className="w-4 h-4" />
                    </span>
                  </div>
                  <h3 className="font-sans text-base font-semibold tracking-wide text-ivory mb-2 uppercase">
                    {step.title}
                  </h3>
                  <p className="text-ivory-soft text-sm leading-relaxed font-normal">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
