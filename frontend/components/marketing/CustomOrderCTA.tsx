import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'

export default function CustomOrderCTA() {
  return (
    <section className="px-5 lg:px-8 py-14 sm:py-20 lg:py-28">
      <div className="relative overflow-hidden max-w-6xl mx-auto text-center
                      p-8 sm:p-12 lg:p-20"
           style={{ borderRadius: '32px' }}
      >
        {/* Glassmorphism background — the only decoration this card needs.
            Two glow orbs + a 70-circle mandala SVG were removed per audit
            §1.6 + §1.3 (visual restraint, fewer DOM nodes). The card now
            reads as one quiet premium block, not a CSS demo. */}
        <div className="absolute inset-0 glass-strong" />

        <div className="relative z-10">
          <span className="eyebrow text-lavender mb-5">
            <Sparkles className="w-3.5 h-3.5" aria-hidden />
            Custom orders
            <Sparkles className="w-3.5 h-3.5" aria-hidden />
          </span>
          <h2 className="display text-4xl sm:text-5xl lg:text-7xl mb-4">
            Want something custom?
            <br />
            <em className="italic gold-text">We&apos;ll make it for you.</em>
          </h2>
          <p className="text-ivory-soft/70 max-w-reader mx-auto text-base lg:text-lg leading-relaxed mb-8">
            Tell us what you have in mind — the colours, the size, the style. We&apos;ll make a piece
            just for you and ship it in one to two weeks.
          </p>
          <Link
            href="/custom-order"
            className="btn-dark inline-flex"
          >
            Start a custom order
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  )
}
