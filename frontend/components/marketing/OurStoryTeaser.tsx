import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight } from 'lucide-react'

export default function OurStoryTeaser() {
  return (
    <section className="px-5 lg:px-8 py-12 lg:py-20 max-w-7xl mx-auto">
      <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
        <div className="relative aspect-[4/5] sm:aspect-[3/2] lg:aspect-square rounded-3xl overflow-hidden border border-gold/15 bg-cream/5">
          <Image
            src="/images/logo-round.png"
            alt="Srilatha at work in her studio"
            fill
            sizes="(min-width: 1024px) 600px, 100vw"
            className="object-cover opacity-90 mix-blend-luminosity"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-primary-dark/40 via-transparent to-gold/10" />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-gold-light/70 mb-2">
            Our story
          </p>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl text-cream mb-5">
            Made by <span className="gold-text">Srilatha</span>,
            <br className="sm:hidden" /> from Hyderabad
          </h2>
          <p className="text-cream/70 leading-relaxed mb-3">
            Every piece begins in a small studio on the outskirts of Hyderabad — a workspace lit by a
            single skylight, scented with resin and rice flour.
          </p>
          <p className="text-cream/70 leading-relaxed mb-7">
            What started as a quiet practice of dot mandalas during the lockdown became a small craft
            house. Today, Srilatha and her two-person team ship art to homes across India.
          </p>
          <Link href="/our-story" className="btn-outline">
            Read the full story
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  )
}
