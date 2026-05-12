import { Quote, Star } from 'lucide-react'

const reviews = [
  {
    name: 'Priya Sharma',
    location: 'Mumbai',
    rating: 5,
    quote:
      'My Lippan piece arrived in a velvet box, hand-wrapped with a note. The mirrors catch the lamp every evening — it is the soul of the room.',
    art: 'Lippan Art',
  },
  {
    name: 'Rajesh K.',
    location: 'Bangalore',
    rating: 5,
    quote:
      'Commissioned a mandala for my mother’s seventieth. The colors, the precision, the timing — all perfect. She cried.',
    art: 'Custom Dot Mandala',
  },
  {
    name: 'Ananya R.',
    location: 'Hyderabad',
    rating: 5,
    quote:
      'These resin coasters made me fall in love with my morning coffee again. Photos do not do them justice.',
    art: 'Resin Coasters',
  },
]

export default function Testimonials() {
  return (
    <section className="py-12 lg:py-20 max-w-7xl mx-auto">
      <div className="px-5 lg:px-8 mb-6 lg:mb-12 text-center">
        <p className="text-[11px] uppercase tracking-[0.3em] text-gold-light/70 mb-2">
          Words from collectors
        </p>
        <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl text-cream">
          What our <span className="gold-text">community says</span>
        </h2>
      </div>

      <div className="lg:hidden">
        <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory px-5 pb-2 scrollbar-hide">
          {reviews.map((r) => (
            <ReviewCard key={r.name} {...r} />
          ))}
          <div className="shrink-0 w-2" aria-hidden />
        </div>
      </div>
      <div className="hidden lg:grid grid-cols-3 gap-6 px-5 lg:px-8">
        {reviews.map((r) => (
          <ReviewCard key={r.name} {...r} />
        ))}
      </div>
    </section>
  )
}

function ReviewCard({
  name,
  location,
  rating,
  quote,
  art,
}: {
  name: string
  location: string
  rating: number
  quote: string
  art: string
}) {
  return (
    <article className="card-glass w-[85vw] sm:w-96 lg:w-auto shrink-0 snap-start p-6 lg:p-7">
      <Quote className="w-6 h-6 text-gold/50 mb-3" aria-hidden />
      <p className="text-cream/85 leading-relaxed text-[15px] mb-4">&ldquo;{quote}&rdquo;</p>
      <div className="flex items-center gap-1 mb-3" aria-label={`Rated ${rating} out of 5`}>
        {Array.from({ length: rating }).map((_, i) => (
          <Star key={i} className="w-3.5 h-3.5 fill-gold text-gold" aria-hidden />
        ))}
      </div>
      <p className="text-sm text-cream font-medium">{name}</p>
      <p className="text-xs text-cream/55">
        {location} · {art}
      </p>
    </article>
  )
}
