'use client'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { CATEGORIES } from '@/data/categories'
import { fadeUp, stagger } from '@/lib/motion'
import { ArrowUpRight } from 'lucide-react'

export default function ShopByArtForm() {
  return (
    <section className="px-5 lg:px-8 py-12 lg:py-20 max-w-7xl mx-auto">
      <div className="mb-8 lg:mb-12 text-center lg:text-left">
        <p className="text-[11px] uppercase tracking-[0.3em] text-gold-light/70 mb-2">
          Five disciplines, one studio
        </p>
        <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl text-cream">
          Shop by <span className="gold-text">art form</span>
        </h2>
      </div>

      <motion.ul
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-80px' }}
        variants={stagger}
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-5"
      >
        {CATEGORIES.map((c, i) => (
          <motion.li key={c.slug} variants={fadeUp}>
            <Link
              href={`/shop/${c.slug}`}
              className="group relative block aspect-[3/4] lg:aspect-[4/5] rounded-2xl overflow-hidden
                         bg-cream/5 border border-gold/10"
            >
              <Image
                src={c.heroImage}
                alt=""
                fill
                sizes="(min-width: 1024px) 20vw, (min-width: 768px) 33vw, 50vw"
                priority={i < 2}
                className="object-cover opacity-30 group-hover:opacity-50 transition-opacity duration-500
                           scale-110 group-hover:scale-125"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink via-primary-dark/40 to-transparent" />
              <div className="absolute inset-0 p-4 lg:p-5 flex flex-col justify-end">
                <h3 className="font-serif text-xl lg:text-2xl text-cream mb-1 leading-tight">
                  {c.title}
                </h3>
                <p className="text-[11px] lg:text-xs text-cream/70 line-clamp-2 mb-3">
                  {c.tagline}
                </p>
                <span
                  className="inline-flex items-center gap-1 text-gold text-xs
                             opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-hidden
                >
                  Explore
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          </motion.li>
        ))}
      </motion.ul>
    </section>
  )
}
