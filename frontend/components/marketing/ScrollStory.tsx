'use client'
import { motion } from 'framer-motion'
import { CATEGORIES } from '@/data/categories'

export default function ScrollStory() {
  return (
    <section
      aria-label="The art forms we practice"
      className="relative bg-ink/40 py-16 lg:py-28 overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary-burnt/8 to-transparent" />
      <div className="relative max-w-3xl mx-auto px-5 lg:px-8 text-center mb-12">
        <p className="text-[11px] uppercase tracking-[0.3em] text-gold-light/70 mb-3">
          A short journey
        </p>
        <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl text-cream">
          Five disciplines, one <span className="gold-text">studio</span>
        </h2>
      </div>

      <div className="max-w-3xl mx-auto px-5 lg:px-8 space-y-16 lg:space-y-28">
        {CATEGORIES.map((c, i) => (
          <motion.article
            key={c.slug}
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
            className={`flex flex-col gap-4 ${
              i % 2 === 0 ? 'items-start text-left' : 'items-end text-right lg:text-right'
            }`}
          >
            <p className="text-[10px] tracking-[0.4em] text-gold uppercase font-medium">
              {String(i + 1).padStart(2, '0')} · {c.title}
            </p>
            <h3 className="font-serif text-2xl md:text-3xl lg:text-4xl text-cream leading-tight max-w-md">
              {c.tagline}
            </h3>
            <p className="text-cream/65 leading-relaxed max-w-md text-base">{c.origin}</p>
          </motion.article>
        ))}
      </div>
    </section>
  )
}
