import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { CATEGORIES } from '@/data/categories'

export const metadata: Metadata = {
  title: 'How it’s made',
  description: 'A short look at the five handmade art styles we make.',
  alternates: { canonical: '/the-craft/' },
}

export default function TheCraftPage() {
  return (
    <main className="max-w-3xl mx-auto px-5 py-16 lg:py-24">
      <p className="eyebrow mb-3">How it’s made</p>
      <h1 className="display text-4xl md:text-5xl lg:text-6xl mb-6">
        Five art styles, <em className="not-italic gold-text">explained</em>
      </h1>
      <p className="text-ivory-soft text-base lg:text-lg leading-relaxed mb-12">
        Each style has its own way of being made. Here&apos;s a quick look at each one - and what
        makes it special.
      </p>

      <div className="space-y-12">
        {CATEGORIES.map((c) => (
          <article key={c.slug}>
            <h2 className="font-serif text-2xl lg:text-3xl text-ivory mb-3">{c.title}</h2>
            <p className="text-ivory-soft text-base lg:text-lg leading-relaxed mb-4">
              {c.origin}
            </p>
            <Link
              href={`/shop/${c.slug}`}
              className="inline-flex items-center gap-1 text-sm text-lavender-pastel hover:underline"
            >
              Shop {c.title}
              <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
          </article>
        ))}
      </div>
    </main>
  )
}
