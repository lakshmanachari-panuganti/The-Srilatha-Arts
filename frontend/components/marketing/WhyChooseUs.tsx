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
      <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-start mb-24">
        {/* Left Side: Why Choose Us */}
        <div className="lg:col-span-5 lg:sticky lg:top-36">
          <span className="eyebrow text-lavender mb-4">Our Quality Promise</span>
          <h2 className="display text-4xl sm:text-5xl lg:text-7xl mb-6 uppercase tracking-tight">
            Why Choose <br />
            <em className="italic text-lavender-pastel">Srilatha Art</em>
          </h2>
          <p className="text-ivory-soft text-lg leading-relaxed mb-8 font-normal">
            We believe that premium home decor should tell a story of dedication, authenticity, and unparalleled craft.
            Every creation is treated as a unique masterwork, built from high-grade raw components and handled with exceptional care.
          </p>
          <div className="p-6 bg-lavender-light border border-glass-border rounded-3xl">
            <p className="text-sm font-semibold tracking-wider uppercase text-ivory mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-lavender-pastel" /> Shipping Guarantee
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
          className="lg:col-span-7 grid sm:grid-cols-2 gap-6"
        >
          {differentiators.map((diff) => {
            const Icon = diff.icon
            return (
              <motion.div
                key={diff.title}
                variants={fadeUp}
                className="p-6 card bg-white border border-glass-border hover:shadow-lavender-glow transition-all duration-300 flex flex-col gap-4"
              >
                <div className="w-12 h-12 rounded-2xl bg-lavender-light border border-glass-border flex items-center justify-center text-lavender">
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-sans text-lg font-semibold tracking-wide text-ivory mb-2 uppercase">
                    {diff.title}
                  </h3>
                  <p className="text-ivory-soft/80 text-sm lg:text-base leading-relaxed font-normal">
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
          <h2 className="display text-4xl sm:text-5xl lg:text-7xl mb-6 uppercase tracking-tight">
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
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8"
        >
          {processSteps.map((step) => {
            return (
              <motion.div
                key={step.step}
                variants={fadeUp}
                className="relative p-6 sm:p-8 card bg-white border border-glass-border flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-3xl font-brand text-lavender-pastel/60 leading-none">
                      {step.step}
                    </span>
                    <span className="w-8 h-8 rounded-full bg-lavender-light border border-glass-border flex items-center justify-center text-lavender">
                      <step.icon className="w-4 h-4" />
                    </span>
                  </div>
                  <h3 className="font-sans text-base font-semibold tracking-wide text-ivory mb-2 uppercase">
                    {step.title}
                  </h3>
                  <p className="text-ivory-soft/80 text-sm leading-relaxed font-normal">
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
