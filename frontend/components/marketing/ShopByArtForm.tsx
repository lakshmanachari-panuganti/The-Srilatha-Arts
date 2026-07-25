'use client'
import Link from 'next/link'
import PictureImage from '@/components/PictureImage'
import { motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { fadeUp, stagger } from '@/lib/motion'

const styleEntries = [
  {
    slug: 'resin',
    title: 'Resin Art',
    tagline: 'Ocean waves, preserved florals, and high-gloss crystalline resin finishes.',
    href: '/shop/resin',
    image: '/category/resin/1d122ae3b1de18057f325bb4eb346151.jpg',
  },
  {
    slug: 'lippan',
    title: 'Lippan Art',
    tagline: 'Hand-shaped mud clay panels with traditional Kutch mirror inlay work.',
    href: '/shop/lippan',
    image: '/category/lippan/1edb12e7ed96b46b7a4e9f79c1a85167.jpg',
  },
  {
    slug: 'dot-mandala',
    title: 'Dot Mandala',
    tagline: 'Thousands of hand-painted dots placed one by one - each mandala unique.',
    href: '/shop/dot-mandala',
    image: '/category/dot-mandala/29edd2b99f56d8048df6aea5ef22895b.jpg',
  },
  {
    slug: 'wedding',
    title: 'Wedding Decor',
    tagline: 'Lippan coconut decor, preserved garlands and personalised wedding keepsakes.',
    href: '/shop/wedding',
    image: '/category/wedding/8e19fc3c91b74b3260878d9b672b44f5.jpg',
  },
  {
    slug: 'kolam',
    title: 'Kolam Art',
    tagline: 'Geometric South Indian rangoli symmetry, made permanent and wall-ready.',
    href: '/shop/kolam',
    image: '/category/kolam/4a9b492ed49541bed2ab9620566352b1.jpg',
  },
  {
    slug: 'gifts',
    title: 'Gift Items',
    tagline: 'Resin coasters, Lippan frames and art sets - beautifully packaged to gift.',
    href: '/shop',
    image: '/category/lippan/1edb12e7ed96b46b7a4e9f79c1a85167.jpg',
  },
] as const

export default function ShopByArtForm() {
  return (
    <section className="px-5 lg:px-8 py-16 sm:py-24 lg:py-32 max-w-7xl mx-auto">
      {/* Section header */}
      <div className="mb-12 sm:mb-16 lg:mb-24 max-w-3xl">
        <p className="eyebrow mb-4 text-lavender">Handcrafted Art</p>
        <h2 className="display text-4xl sm:text-5xl lg:text-7xl mb-6 uppercase">
          Explore Our <em className="italic text-lavender-pastel">Collections</em>
        </h2>
        <p className="text-ivory-soft text-lg lg:text-xl leading-relaxed font-normal">
          From shimmering traditional mud-mirror art to sleek, glass-like resin work.
          Browse our curated collections or commission a custom statement piece designed for your space.
        </p>
      </div>

      {/* 6-Card Responsive Grid */}
      <motion.ul
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-40px' }}
        variants={stagger}
        className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-8 lg:gap-10"
      >
        {styleEntries.map((item, i) => (
          <motion.li
            key={item.slug}
            variants={fadeUp}
            className="flex"
          >
            <Link
              href={item.href}
              className="group relative flex flex-col justify-between w-full card p-3 sm:p-5 lg:p-6
                         bg-[#FEFCF8] border border-glass-border hover:border-lavender-pastel/40
                         transition-all duration-500 hover:shadow-lavender-glow-lg hover:-translate-y-1"
            >
              <div>
                {/* Image Frame */}
                <div className="relative aspect-[4/3] overflow-hidden mb-3 sm:mb-6 rounded-lg border border-glass-border">
                  <PictureImage
                    src={item.image}
                    alt={item.title}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 50vw"
                    priority={i < 3}
                    className="object-cover transition-transform duration-1000 ease-out group-hover:scale-[1.05]"
                  />
                </div>

                <h3 className="font-serif text-2xl lg:text-3xl text-slate-950 leading-tight mb-2
                               group-hover:text-lavender-pastel transition-colors duration-300">
                  {item.title}
                </h3>
                <p className="text-slate-700 text-sm lg:text-base leading-relaxed mb-6 font-normal">
                  {item.tagline}
                </p>
              </div>

              <div className="flex items-center justify-between mt-auto pt-4 border-t border-glass-border/30">
                <span className="text-xs font-semibold tracking-wider uppercase text-lavender group-hover:text-lavender-pastel transition-colors duration-300">
                  {item.slug === 'gifts' ? 'Browse Gift Ideas' : 'View Collection'}
                </span>
                <span
                  aria-hidden
                  className="shrink-0 w-8 h-8 rounded-full border border-glass-border
                             group-hover:border-lavender-pastel/40 group-hover:bg-lavender-soft/20 group-hover:text-lavender-pastel
                             flex items-center justify-center transition-all duration-300 text-ivory-mute"
                >
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
