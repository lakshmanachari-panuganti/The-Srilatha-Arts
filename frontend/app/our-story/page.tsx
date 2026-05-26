import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'About us',
  description: 'How Srilatha started a small handmade art studio in Hyderabad.',
}

export default function OurStoryPage() {
  return (
    <main className="max-w-3xl mx-auto px-5 py-16 lg:py-24">
      <p className="eyebrow mb-3">About us</p>
      <h1 className="display text-4xl md:text-5xl lg:text-6xl mb-6">
        A small studio in <em className="italic gold-text">Hyderabad</em>
      </h1>
      <p className="text-ivory-soft text-base lg:text-lg leading-relaxed mb-6">
        Hi! We are a small team that makes handmade rlegant art. Everything you see on this site
        is made by us in our studio in Hyderabad.
      </p>

      <div className="my-10 relative aspect-[4/3] rounded-3xl overflow-hidden bg-gradient-to-b from-plum-warm to-plum-light flex items-center justify-center">
        <Image
          src="/Logos/logo.jpeg"
          alt="Our studio in Hyderabad"
          width={300}
          height={300}
          className="object-contain p-10"
        />
      </div>

      <h2 className="font-serif text-2xl lg:text-3xl text-ivory mt-12 mb-4">How it started</h2>
      <p className="text-ivory-soft text-base lg:text-lg leading-relaxed mb-4">
        During the lockdown in 2020, Srilatha started painting dot mandalas at home — just to keep
        herself busy. Friends and family loved them, and started asking for pieces of their own.
      </p>
      <p className="text-ivory-soft text-base lg:text-lg leading-relaxed mb-4">
        One thing led to another. Today, we make five different styles of handmade art —
        Resin, Dot Mandala, Lippan, Kolam and Wedding Decoratives — and we ship them to homes all over India.
      </p>

      <h2 className="font-serif text-2xl lg:text-3xl text-ivory mt-12 mb-4">How we work</h2>
      <p className="text-ivory-soft text-base lg:text-lg leading-relaxed mb-4">
        Each piece is made by hand. That means no two pieces are exactly the same — and that&apos;s
        the whole point. We take our time so every artwork looks just right when it reaches you.
      </p>
      <p className="text-ivory-soft text-base lg:text-lg leading-relaxed mb-8">
        We also make custom pieces — your colour, your size, your style. Just tell us what you have
        in mind and we&apos;ll bring it to life.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/shop" className="btn-dark">
          Shop all art
          <ArrowRight className="w-4 h-4" aria-hidden />
        </Link>
        <Link href="/custom-order" className="btn-outline">
          Order a custom piece
        </Link>
      </div>
    </main>
  )
}
