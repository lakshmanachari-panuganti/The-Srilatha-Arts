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
  const titleWords = goldWord ? title.split(goldWord) : null

  return (
    <main className="min-h-svh max-w-3xl mx-auto px-5 py-20 lg:py-32 text-center">
      <p className="eyebrow justify-center mb-4">{eyebrow}</p>
      <h1 className="display text-4xl md:text-5xl lg:text-7xl mb-6">
        {titleWords ? (
          <>
            {titleWords[0]}
            <em className="italic gold-text">{goldWord}</em>
            {titleWords[1]}
          </>
        ) : (
          title
        )}
      </h1>
      <p className="text-ivory-soft leading-relaxed mb-10 max-w-reader mx-auto text-base lg:text-lg">
        {description}
      </p>
      <Link href={primaryHref} className="btn-dark">
        {primaryLabel}
        <ArrowRight className="w-4 h-4" aria-hidden />
      </Link>
    </main>
  )
}
