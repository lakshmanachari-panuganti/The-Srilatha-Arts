import { Quote, Star } from 'lucide-react'

const reviews = [
  {
    name: 'Priya Sharma',
    location: 'Mumbai',
    rating: 5,
    quote:
      'My Lippan piece arrived hand-wrapped with a note. The mirrors catch the lamp every evening — it is the soul of the room.',
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
    <section className="px-5 lg:px-8 py-16 lg:py-28 max-w-6xl mx-auto">
      <div className="mb-10 lg:mb-14 max-w-2xl">
        <p className="eyebrow mb-4">
          <span className="section-no text-terracotta">005</span>
          Words from collectors
        </p>
        <h2 className="display text-4xl lg:text-6xl">
          What our <em className="italic">community</em> says.
        </h2>
      </div>

      {/* Mobile carousel */}
      <div className="lg:hidden">
        <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-5 px-5 scrollbar-hide">
          {reviews.map((r) => (
            <ReviewCard key={r.name} {...r} />
          ))}
          <div className="shrink-0 w-2" aria-hidden />
        </div>
      </div>
      <div className="hidden lg:grid grid-cols-3 gap-7">
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
    <article className="card w-[80vw] sm:w-96 lg:w-auto shrink-0 snap-start p-7 lg:p-8 flex flex-col">
      <Quote className="w-7 h-7 text-terracotta/60 mb-4" aria-hidden />
      <p className="font-serif text-lg lg:text-xl text-ink leading-relaxed mb-5 flex-1">
        &ldquo;{quote}&rdquo;
      </p>
      <div className="flex items-center gap-1 mb-3" aria-label={`Rated ${rating} out of 5`}>
        {Array.from({ length: rating }).map((_, i) => (
          <Star key={i} className="w-3.5 h-3.5 fill-gold text-gold" aria-hidden />
        ))}
      </div>
      <div className="pt-4 border-t border-ink/10">
        <p className="text-sm text-ink font-medium">{name}</p>
        <p className="text-xs text-ink-mute mt-0.5">
          {location} · {art}
        </p>
      </div>
    </article>
  )
}
