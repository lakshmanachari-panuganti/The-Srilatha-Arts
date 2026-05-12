import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'

export default function CustomOrderCTA() {
  return (
    <section className="px-5 lg:px-8 py-16 lg:py-24">
      <div className="relative overflow-hidden max-w-6xl mx-auto rounded-[32px]
                      bg-ink text-cream
                      p-10 sm:p-14 lg:p-20 text-center">
        {/* Decorative kolam dots */}
        <svg
          viewBox="0 0 600 300"
          className="absolute inset-0 w-full h-full text-gold/12"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden
        >
          {Array.from({ length: 70 }).map((_, i) => {
            const a = (i / 70) * Math.PI * 2
            const r = 60 + (i % 5) * 28
            return (
              <circle
                key={i}
                cx={300 + Math.cos(a) * r}
                cy={150 + Math.sin(a) * r * 0.7}
                r="1.5"
                fill="currentColor"
              />
            )
          })}
        </svg>

        <div className="relative">
          <span className="inline-flex items-center gap-2 text-[11px] tracking-[0.32em] uppercase text-gold-light mb-5">
            <Sparkles className="w-3.5 h-3.5" aria-hidden />
            Commissions open
            <Sparkles className="w-3.5 h-3.5" aria-hidden />
          </span>
          <h2 className="font-serif text-4xl sm:text-5xl lg:text-7xl leading-[1.02] mb-4">
            Have a vision?
            <br />
            <em className="italic text-gold-light">We&apos;ll craft it.</em>
          </h2>
          <p className="text-cream/70 max-w-reader mx-auto text-base lg:text-lg leading-relaxed mb-8">
            Commission a one-of-a-kind piece — tell us the form, palette and story; we&apos;ll bring
            it to life in two to four weeks.
          </p>
          <Link
            href="/custom-order"
            className="btn inline-flex bg-cream text-ink rounded-full hover:bg-cream/90"
          >
            Start your commission
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  )
}
