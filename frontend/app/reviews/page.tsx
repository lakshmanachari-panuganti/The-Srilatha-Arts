import type { Metadata } from 'next'
import Link from 'next/link'
import { Star } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Customer reviews',
  description: 'Real reviews from people who bought our handmade art.',
}

const reviews = [
  {
    name: 'Priya Sharma',
    location: 'Mumbai',
    rating: 5,
    quote:
      'My Lippan piece came beautifully packed with a handwritten note. The little mirrors look lovely under the lamp every evening. Truly handmade.',
    product: 'Lippan Art',
  },
  {
    name: 'Rajesh K.',
    location: 'Bangalore',
    rating: 5,
    quote:
      'I ordered a mandala for my mother\'s 70th birthday. The colours and the details were perfect, and it arrived right on time. She loved it.',
    product: 'Custom Dot Mandala',
  },
  {
    name: 'Ananya R.',
    location: 'Hyderabad',
    rating: 5,
    quote:
      'The resin coasters look even better in person than in the photos. I use them every morning with my coffee.',
    product: 'Resin Coasters',
  },
  {
    name: 'Meera Iyer',
    location: 'Chennai',
    rating: 5,
    quote:
      'The kolam wall art reminds me of my grandmother every morning. Beautiful work and good quality. Will buy more.',
    product: 'Kolam Art',
  },
  {
    name: 'Vikram S.',
    location: 'Delhi',
    rating: 5,
    quote:
      'Quick replies on WhatsApp, fair pricing, and the piece arrived earlier than promised. Highly recommend.',
    product: 'Wedding Decoratives',
  },
]

export default function ReviewsPage() {
  return (
    <main className="max-w-3xl mx-auto px-5 py-16 lg:py-24">
      <p className="eyebrow mb-3">Customer reviews</p>
      <h1 className="display text-4xl md:text-5xl lg:text-6xl mb-5">
        Real reviews from real <em className="italic gold-text">buyers</em>
      </h1>
      <p className="text-ivory-soft text-base lg:text-lg leading-relaxed mb-10">
        Here&apos;s what people who bought from us have said. We&apos;re proud of every piece we ship.
      </p>

      <ul className="space-y-5">
        {reviews.map((r) => (
          <li key={r.name} className="card p-6 lg:p-7">
            <div className="flex items-center gap-1 mb-3" aria-label={`Rated ${r.rating} out of 5`}>
              {Array.from({ length: r.rating }).map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-lavender-pastel text-lavender-pastel" aria-hidden />
              ))}
            </div>
            <p className="text-ivory text-base lg:text-lg leading-relaxed mb-4">
              &ldquo;{r.quote}&rdquo;
            </p>
            <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-ivory">
                <span className="font-medium">{r.name}</span>
                <span className="text-ivory-mute"> · {r.location}</span>
              </p>
              <p className="text-xs text-ivory-mute uppercase tracking-wider">{r.product}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="text-center mt-12">
        <p className="text-ivory-soft mb-4">Got something to share? We&apos;d love to hear from you.</p>
        <Link href="/contact" className="btn-outline">Send us a review</Link>
      </div>
    </main>
  )
}
