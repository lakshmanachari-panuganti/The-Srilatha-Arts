import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

interface Props {
  eyebrow?: string
  title: string
  goldWord?: string
  description?: string
  primaryHref?: string
  primaryLabel?: string
}

export default function PlaceholderPage({
  eyebrow = 'Coming soon',
  title,
  goldWord,
  description = 'This page is in the studio. Check back as we unfold the experience.',
  primaryHref = '/shop',
  primaryLabel = 'Browse the shop',
}: Props) {
  const titleWords = goldWord
    ? title.split(goldWord)
    : null

  return (
    <main className="min-h-svh max-w-3xl mx-auto px-5 py-16 lg:py-28 text-center">
      <p className="text-[11px] uppercase tracking-[0.3em] text-gold-light/70 mb-3">
        {eyebrow}
      </p>
      <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-cream leading-tight mb-5">
        {titleWords ? (
          <>
            {titleWords[0]}
            <span className="gold-text">{goldWord}</span>
            {titleWords[1]}
          </>
        ) : (
          title
        )}
      </h1>
      <p className="text-cream/65 leading-relaxed mb-8 max-w-xl mx-auto">{description}</p>
      <Link href={primaryHref} className="btn-gold">
        {primaryLabel}
        <ArrowRight className="w-4 h-4" aria-hidden />
      </Link>
    </main>
  )
}
