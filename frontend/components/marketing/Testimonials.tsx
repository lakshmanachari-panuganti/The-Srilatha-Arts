import { Quote, Star } from 'lucide-react'

const reviews = [
  {
    name: 'Priya Sharma',
    location: 'Mumbai',
    rating: 5,
    quote:
      'My Lippan piece came beautifully packed with a handwritten note. The little mirrors look lovely under the lamp every evening.',
    art: 'Lippan Art',
  },
  {
    name: 'Rajesh K.',
    location: 'Bangalore',
    rating: 5,
    quote:
      'I ordered a mandala for my mother\'s 70th birthday. The colours and the details were perfect, and it arrived right on time. She loved it.',
    art: 'Custom Dot Mandala',
  },
  {
    name: 'Ananya R.',
    location: 'Hyderabad',
    rating: 5,
    quote:
      'The resin coasters look even better in person than in the photos. I use them every morning with my coffee.',
    art: 'Resin Coasters',
  },
]

export default function Testimonials() {
  return (
    <section className="relative px-5 lg:px-8 py-20 lg:py-32 max-w-6xl mx-auto">
      {/* Subtle ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px]
                       rounded-full bg-purple-300/10 blur-[100px]" aria-hidden />

      <div className="relative z-10">
        <div className="mb-12 lg:mb-16 max-w-2xl">
          <p className="eyebrow mb-4">
            <span className="section-no text-pink-500">005</span>
            Real customer reviews
          </p>
          <h2 className="display text-4xl lg:text-6xl text-purple-950">
            What our <em className="italic gold-text">buyers</em> say.
          </h2>
        </div>

        {/* Mobile carousel */}
        <div className="lg:hidden">
          <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 -mx-5 px-5 scrollbar-hide">
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
    <article className="card w-[80vw] sm:w-96 lg:w-auto shrink-0 snap-start p-7 lg:p-8 flex flex-col bg-white/70 border border-purple-200/50">
      <Quote className="w-7 h-7 text-pink-400 mb-4" aria-hidden />
      <p className="font-serif text-lg lg:text-xl text-purple-950 font-bold leading-relaxed mb-5 flex-1">
        &ldquo;{quote}&rdquo;
      </p>
      <div className="flex items-center gap-1 mb-4" aria-label={`Rated ${rating} out of 5`}>
        {Array.from({ length: rating }).map((_, i) => (
          <Star key={i} className="w-4 h-4 fill-pink-500 text-pink-500" aria-hidden />
        ))}
      </div>
      <div className="pt-4 border-t border-purple-100">
        <p className="text-sm text-purple-950 font-bold">{name}</p>
        <p className="text-xs text-purple-900/80 font-semibold mt-0.5">
          {location} · {art}
        </p>
      </div>
    </article>
  )
}
