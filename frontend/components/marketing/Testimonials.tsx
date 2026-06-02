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
    <section className="relative px-5 lg:px-8 py-14 sm:py-20 lg:py-32 max-w-6xl mx-auto">
      {/* No ambient glow orb - visual restraint per audit §1.6. The hero
          slideshow is the page's single moment of "atmospheric" decoration. */}

      <div className="relative z-10">
        <div className="mb-8 sm:mb-12 lg:mb-16 max-w-2xl">
          <p className="eyebrow mb-4">Real customer reviews</p>
          <h2 className="display text-4xl lg:text-6xl">
            What our <em className="italic">buyers</em> say.
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
      {/* Lavender-pastel stars first - the rating is the strongest credibility signal,
          so it leads the card. */}
      <div className="flex items-center gap-1 mb-4" aria-label={`Rated ${rating} out of 5`}>
        {Array.from({ length: rating }).map((_, i) => (
          <Star key={i} className="w-4 h-4 fill-lavender-pastel text-lavender-pastel" aria-hidden />
        ))}
      </div>
      <Quote className="w-6 h-6 text-lavender-pastel/70 mb-3" aria-hidden />
      <p className="font-serif text-lg lg:text-xl text-ivory leading-relaxed mb-6 flex-1">
        &ldquo;{quote}&rdquo;
      </p>
      <div className="pt-4 border-t border-lavender-soft/25">
        <p className="text-sm text-ivory font-semibold tracking-wide">{name}</p>
        <p className="text-xs text-ivory-mute mt-0.5 flex items-center gap-1.5">
          <span>{location}</span>
          <span className="w-1 h-1 rounded-full bg-lavender-pastel/60" aria-hidden />
          <span>{art}</span>
        </p>
      </div>
    </article>
  )
}
