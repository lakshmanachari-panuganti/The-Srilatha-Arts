import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight } from 'lucide-react'

export default function OurStoryTeaser() {
  return (
    <section className="px-5 lg:px-8 py-14 sm:py-20 lg:py-32 max-w-6xl mx-auto">
      <div className="grid lg:grid-cols-12 gap-8 lg:gap-16 items-center">
        {/* Image - editorial offset with glow */}
        <div className="lg:col-span-6">
          <div className="relative aspect-[4/5] overflow-hidden
                          bg-gradient-to-b from-plum-warm to-plum-light
                          border border-glass-border glow-hover"
               style={{ borderRadius: '24px' }}
          >
            {/* Ambient glow behind image */}
            <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
              <div className="w-3/4 h-3/4 rounded-full bg-lavender-soft/10 blur-[60px]" />
            </div>
            <Image
              src="/images/logo.png"
              alt="A view of the Hyderabad studio"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="relative object-contain p-12 lg:p-20"
            />
            <span className="absolute top-5 left-5 sticker -rotate-2">
              <span className="opacity-70 mr-2">003</span>
              Our studio
            </span>
          </div>
        </div>

        <div className="lg:col-span-6 lg:pl-6">
          <p className="eyebrow mb-4">About us</p>
          <h2 className="display text-4xl lg:text-6xl mb-5">
            Made in
            <br />
            <em className="italic">Hyderabad</em>.
          </h2>
          <p className="text-ivory-soft text-base lg:text-lg leading-relaxed mb-4">
            Every piece is made by hand in our small Hyderabad studio. We take our time so each
            artwork comes out exactly right.
          </p>
          <p className="text-ivory-soft text-base lg:text-lg leading-relaxed mb-8">
            Srilatha started painting dot mandalas during the lockdown. Today, she and her small team
            ship handmade art to homes all over India.
          </p>
          <Link href="/our-story" className="btn-link">
            Read our full story
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  )
}
