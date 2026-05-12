'use client'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { CATEGORIES } from '@/data/categories'
import { fadeUp, stagger } from '@/lib/motion'

export default function ShopByArtForm() {
  return (
    <section className="px-5 lg:px-8 py-16 lg:py-28 max-w-6xl mx-auto">
      {/* Section header */}
      <div className="mb-10 lg:mb-16 max-w-2xl">
        <p className="eyebrow mb-4">
          <span className="section-no text-terracotta">001</span>
          The collections
        </p>
        <h2 className="display text-4xl lg:text-6xl mb-4">
          Five disciplines,
          <br />
          one <em className="font-serif italic">studio</em>.
        </h2>
        <p className="text-ink-soft text-base lg:text-lg leading-relaxed">
          From the meditative rhythm of Dot Mandala to the salt-desert mirror work of Lippan — each
          art form has its own voice. Pick one that calls to you.
        </p>
      </div>

      {/* Editorial grid */}
      <motion.ul
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-80px' }}
        variants={stagger}
        className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-12 lg:gap-x-10 lg:gap-y-20"
      >
        {CATEGORIES.map((c, i) => (
          <motion.li
            key={c.slug}
            variants={fadeUp}
            className={
              // Stagger sm:second-col items down for an asymmetric magazine feel
              i % 2 === 1 ? 'sm:mt-16 lg:mt-24' : ''
            }
          >
            <Link
              href={`/shop/${c.slug}`}
              className="group block"
            >
              <div className="relative aspect-[4/5] rounded-[28px] overflow-hidden bg-cream-deep mb-5">
                <Image
                  src={c.heroImage}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  priority={i < 2}
                  className="object-contain p-8 sm:p-10 transition-transform duration-700 group-hover:scale-[1.04]"
                />
                {/* Small floating badge */}
                <div className="absolute top-4 left-4">
                  <span className="sticker -rotate-2">
                    <span className="section-no text-cream/70 mr-2">{String(i + 1).padStart(2, '0')}</span>
                    {c.title.split(' ')[0]}
                  </span>
                </div>
              </div>

              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h3 className="font-serif text-2xl lg:text-3xl text-ink leading-tight mb-2 group-hover:text-terracotta transition-colors">
                    {c.title}
                  </h3>
                  <p className="text-ink-soft text-sm lg:text-base leading-relaxed line-clamp-2">
                    {c.tagline}
                  </p>
                </div>
                <span
                  aria-hidden
                  className="shrink-0 w-10 h-10 rounded-full border border-ink/15 group-hover:border-ink group-hover:bg-ink group-hover:text-cream
                             flex items-center justify-center transition-all duration-300"
                >
                  <ArrowUpRight className="w-4 h-4" />
                </span>
              </div>
            </Link>
          </motion.li>
        ))}
      </motion.ul>
    </section>
  )
}
