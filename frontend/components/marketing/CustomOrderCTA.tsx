import Link from 'next/link'
import { Sparkles, ArrowRight } from 'lucide-react'

export default function CustomOrderCTA() {
  return (
    <section className="px-5 lg:px-8 my-16 lg:my-24">
      <div className="max-w-6xl mx-auto relative overflow-hidden rounded-3xl
                      bg-gradient-to-br from-primary-burnt via-primary-dark to-ink
                      border border-gold/20 p-8 lg:p-16 text-center">
        <div className="absolute inset-0 opacity-20" aria-hidden>
          <svg viewBox="0 0 200 200" className="w-full h-full">
            {Array.from({ length: 100 }).map((_, i) => {
              const a = (i / 100) * Math.PI * 2
              const r = 60 + (i % 4) * 20
              return (
                <circle
                  key={i}
                  cx={100 + Math.cos(a) * r}
                  cy={100 + Math.sin(a) * r}
                  r="1"
                  fill="#D4AF37"
                />
              )
            })}
          </svg>
        </div>

        <div className="relative">
          <Sparkles className="w-8 h-8 text-gold mx-auto mb-4" aria-hidden />
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl text-cream mb-3">
            Have a vision?
            <br className="sm:hidden" />
            <span className="gold-text"> We&apos;ll craft it.</span>
          </h2>
          <p className="text-cream/70 max-w-lg mx-auto mb-7">
            Commission a one-of-a-kind piece — tell us the form, palette and story; we&apos;ll bring
            it to life in 2–4 weeks.
          </p>
          <Link href="/custom-order" className="btn-gold">
            Start your commission
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  )
}
