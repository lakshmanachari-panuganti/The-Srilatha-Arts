import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Star, Hand, Sparkles, Truck, ChevronLeft, ChevronRight } from 'lucide-react'
import { PRODUCTS, getProductById, getProductsByCategory } from '@/data/products'
import { CATEGORY_BY_SLUG } from '@/data/categories'
import { formatINR, discountPct } from '@/lib/format'
import StickyCartBar from '@/components/shop/StickyCartBar'
import ProductCard from '@/components/shop/ProductCard'

interface Props {
  params: Promise<{ id: string }>
}

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ id: p.id }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const p = getProductById(id)
  if (!p) return { title: 'Not found' }
  return {
    title: p.title,
    description: p.shortDescription,
    openGraph: {
      title: p.title,
      description: p.shortDescription,
      images: p.images,
    },
  }
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params
  const p = getProductById(id)
  if (!p) notFound()

  const category = CATEGORY_BY_SLUG[p.category]
  const related = getProductsByCategory(p.category)
    .filter((r) => r.id !== p.id)
    .slice(0, 4)
  const pct = discountPct(p.price, p.compareAtPrice)

  return (
    <>
      <div className="max-w-7xl mx-auto lg:grid lg:grid-cols-2 lg:gap-12 lg:px-8 lg:pt-8">
        {/* Gallery — full-bleed mobile, sticky on desktop */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="lg:rounded-3xl overflow-hidden bg-cream/5 border-y lg:border lg:border-gold/10 border-gold/5">
            <div className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide aspect-[4/5]">
              {(p.images.length > 0 ? p.images : ['/images/logo-round.png']).map((src, i) => (
                <div key={i} className="relative shrink-0 w-full snap-center">
                  <Image
                    src={src}
                    alt={`${p.title} — image ${i + 1}`}
                    fill
                    sizes="(min-width: 1024px) 50vw, 100vw"
                    priority={i === 0}
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="px-5 lg:px-0 pt-6 lg:pt-0 pb-32 lg:pb-12">
          <Link
            href={`/shop/${category?.slug}`}
            className="inline-flex items-center gap-1 text-xs text-cream/55 hover:text-gold transition-colors mb-3"
          >
            <ChevronLeft className="w-3.5 h-3.5" aria-hidden />
            {category?.title}
          </Link>

          <h1 className="font-serif text-3xl md:text-4xl text-cream leading-tight mb-3">
            {p.title}
          </h1>

          {p.rating !== undefined && (
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={
                      i < Math.round(p.rating ?? 0)
                        ? 'w-3.5 h-3.5 fill-gold text-gold'
                        : 'w-3.5 h-3.5 text-cream/20'
                    }
                    aria-hidden
                  />
                ))}
              </div>
              <span className="text-xs text-cream/60">
                {p.rating?.toFixed(1)} · {p.reviewCount} reviews
              </span>
            </div>
          )}

          <div className="flex items-baseline gap-3 mb-1">
            <span className="font-serif text-3xl text-cream">{formatINR(p.price)}</span>
            {p.compareAtPrice && (
              <>
                <span className="text-cream/40 line-through">{formatINR(p.compareAtPrice)}</span>
                {pct !== null && (
                  <span className="text-xs font-bold text-gold-light bg-primary-burnt px-2 py-0.5 rounded-full">
                    SAVE {pct}%
                  </span>
                )}
              </>
            )}
          </div>
          <p className="text-xs text-cream/45 mb-6">Inclusive of all taxes</p>

          {/* Spec pills */}
          <div className="flex flex-wrap gap-2 mb-6">
            <Pill label={p.size} />
            <Pill label={p.material} />
            <Pill label={`Ships in ${p.timeToMake}`} />
          </div>

          {/* Description */}
          <p className="text-cream/80 leading-relaxed mb-6">{p.description}</p>

          {/* What makes it special */}
          <div className="card-glass p-5 mb-6 space-y-3">
            <Feature icon={Hand} label="Handmade — no two are alike" />
            <Feature icon={Sparkles} label={`Crafted in ${p.timeToMake}`} />
            <Feature icon={Truck} label="Free shipping above ₹2,999 · Pan-India" />
          </div>

          {/* Care */}
          <details className="border-t border-gold/10 py-4">
            <summary className="cursor-pointer flex items-center justify-between text-cream font-medium">
              Care instructions
              <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" aria-hidden />
            </summary>
            <p className="text-cream/65 text-sm leading-relaxed mt-3">{p.careInstructions}</p>
          </details>
          <details className="border-t border-gold/10 py-4">
            <summary className="cursor-pointer flex items-center justify-between text-cream font-medium">
              Shipping & returns
              <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" aria-hidden />
            </summary>
            <p className="text-cream/65 text-sm leading-relaxed mt-3">
              Dispatched from Hyderabad. Most orders arrive in 5–7 working days. 7-day exchange on
              unopened items. <Link href="/shipping-and-returns" className="text-gold hover:underline">Read full policy</Link>.
            </p>
          </details>
        </div>
      </div>

      {related.length > 0 && (
        <section className="max-w-7xl mx-auto pt-12 pb-16">
          <h2 className="font-serif text-2xl lg:text-3xl text-cream px-5 lg:px-8 mb-6">
            You may also <span className="gold-text">love</span>
          </h2>
          <div className="lg:hidden flex gap-4 overflow-x-auto snap-x snap-mandatory px-5 pb-2 scrollbar-hide">
            {related.map((r) => (
              <ProductCard key={r.id} product={r} variant="carousel" />
            ))}
            <div className="shrink-0 w-2" aria-hidden />
          </div>
          <div className="hidden lg:grid grid-cols-4 gap-6 px-8">
            {related.map((r) => (
              <ProductCard key={r.id} product={r} />
            ))}
          </div>
        </section>
      )}

      <StickyCartBar product={p} />
    </>
  )
}

function Pill({ label }: { label: string }) {
  return (
    <span className="inline-flex h-9 px-3 items-center rounded-full border border-gold/20 text-xs text-cream/85">
      {label}
    </span>
  )
}

function Feature({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-cream/85">
      <span className="w-9 h-9 rounded-full bg-gold/10 text-gold flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4" aria-hidden />
      </span>
      {label}
    </div>
  )
}
