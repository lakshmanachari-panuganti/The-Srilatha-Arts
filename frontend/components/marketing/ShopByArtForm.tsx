'use client'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { CATEGORIES } from '@/data/categories'
import { fadeUp, stagger } from '@/lib/motion'

export default function ShopByArtForm() {
  return (
    <section className="px-5 lg:px-8 py-14 sm:py-20 lg:py-32 max-w-6xl mx-auto">
      {/* Section header */}
      <div className="mb-10 sm:mb-12 lg:mb-20 max-w-2xl">
        <p className="eyebrow mb-4">
          <span className="section-no text-lavender-pastel">001</span>
          Shop by art style
        </p>
        <h2 className="display text-4xl lg:text-6xl mb-4">
          Five handmade
          <br />
          art <em className="font-serif italic">styles</em>.
        </h2>
        <p className="text-ivory-soft text-base lg:text-lg leading-relaxed">
          From calming dot patterns to bright mirror work, each style has its own look and feel.
          Pick the one you love.
        </p>
      </div>

      {/* Editorial grid */}
      <motion.ul
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-80px' }}
        variants={stagger}
        className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-8 sm:gap-y-14 lg:gap-x-10 lg:gap-y-24"
      >
        {CATEGORIES.map((c, i) => (
          <motion.li
            key={c.slug}
            variants={fadeUp}
            className={
              // Stagger sm:second-col items down for asymmetric magazine feel
              i % 2 === 1 ? 'sm:mt-16 lg:mt-24' : ''
            }
          >
            <Link
              href={`/shop/${c.slug}`}
              className="group block"
            >
              <div className="relative aspect-[4/5] overflow-hidden mb-5
                              bg-gradient-to-b from-plum-warm/80 to-plum/60
                              border border-glass-border
                              transition-all duration-700 group-hover:border-lavender-pastel/20
                              group-hover:shadow-lavender-glow"
                   style={{ borderRadius: '24px' }}
              >
                <Image
                  src={c.heroImage}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  priority={i < 2}
                  className="object-contain p-8 sm:p-10 transition-transform duration-1000 ease-out group-hover:scale-[1.04]"
                />
                {/* Soft gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-plum/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                {/* Small floating badge */}
                <div className="absolute top-4 left-4">
                  <span className="sticker -rotate-2">
                    <span className="opacity-70 mr-2">{String(i + 1).padStart(2, '0')}</span>
                    {c.title.split(' ')[0]}
                  </span>
                </div>
              </div>

              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h3 className="font-serif text-2xl lg:text-3xl text-ivory leading-tight mb-2
                                 group-hover:text-lavender-pastel transition-colors duration-500">
                    {c.title}
                  </h3>
                  <p className="text-ivory-mute text-sm lg:text-base leading-relaxed line-clamp-2">
                    {c.tagline}
                  </p>
                </div>
                <span
                  aria-hidden
                  className="shrink-0 w-10 h-10 rounded-full
                             border border-glass-border
                             group-hover:border-lavender-pastel/40 group-hover:bg-lavender-soft/20 group-hover:text-lavender-pastel
                             flex items-center justify-center transition-all duration-500 text-ivory-mute"
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
