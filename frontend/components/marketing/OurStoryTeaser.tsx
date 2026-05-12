import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight } from 'lucide-react'

export default function OurStoryTeaser() {
  return (
    <section className="px-5 lg:px-8 py-16 lg:py-28 max-w-6xl mx-auto">
      <div className="grid lg:grid-cols-12 gap-8 lg:gap-16 items-center">
        {/* Image — offset slightly on desktop for editorial feel */}
        <div className="lg:col-span-6">
          <div className="relative aspect-[4/5] rounded-[28px] overflow-hidden bg-cream-deep">
            <Image
              src="/images/logo.png"
              alt="A view of the Hyderabad studio"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-contain p-12 lg:p-20"
            />
            <span className="absolute top-5 left-5 sticker -rotate-2">
              <span className="section-no text-cream/70 mr-2">003</span>
              The Studio
            </span>
          </div>
        </div>

        <div className="lg:col-span-6 lg:pl-6">
          <p className="eyebrow mb-4">Our story</p>
          <h2 className="display text-4xl lg:text-6xl mb-5">
            A skylit room in
            <br />
            <em className="italic">Hyderabad</em>.
          </h2>
          <p className="text-ink-soft text-base lg:text-lg leading-relaxed mb-4">
            Every piece begins in a small studio on the outskirts of Hyderabad — a workspace lit by a
            single skylight, scented with resin and rice flour.
          </p>
          <p className="text-ink-soft text-base lg:text-lg leading-relaxed mb-8">
            What started as a quiet practice of dot mandalas during the lockdown became a small craft
            house. Today, Srilatha and her two-person team ship art to homes across India.
          </p>
          <Link href="/our-story" className="btn-link">
            Read the full story
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  )
}
