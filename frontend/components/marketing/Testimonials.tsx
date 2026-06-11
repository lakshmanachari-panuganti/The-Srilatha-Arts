import { Quote, Star, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { stagger, fadeUp } from '@/lib/motion'

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
      "I ordered a mandala for my mother's 70th birthday. The colours and the details were perfect, and it arrived right on time. She loved it.",
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
    <motion.section
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="relative px-5 lg:px-8 py-14 sm:py-20 lg:py-32 max-w-6xl mx-auto"
    >
      <div className="relative z-10">
        <div className="mb-8 sm:mb-12 lg:mb-16 max-w-2xl">
          <p className="eyebrow mb-4">Real customer reviews</p>
          <h2 className="display text-4xl lg:text-6xl">
            What our <em className="italic">buyers</em> say.
          </h2>
        </div>

        {/* Mobile carousel with swipe hint */}
        <div className="lg:hidden">
          <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-5 px-5 scrollbar-hide">
            {reviews.map((r) => (
              <ReviewCard key={r.name} {...r} />
            ))}
            <div className="shrink-0 w-2" aria-hidden />
          </div>
          {/* Swipe discovery hint — only shown on mobile */}
          <p
            className="mt-3 flex items-center justify-end gap-1 text-[11px] uppercase tracking-widest text-ivory-mute"
            aria-hidden
          >
            Swipe to see more
            <ChevronRight className="w-3 h-3" />
          </p>
        </div>

        {/* Desktop staggered grid */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-20px' }}
          variants={stagger}
          className="hidden lg:grid grid-cols-3 gap-7"
        >
          {reviews.map((r) => (
            <motion.div key={r.name} variants={fadeUp}>
              <ReviewCard {...r} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.section>
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
  // Generate a consistent avatar color from the name initial
  const initial = name.charAt(0).toUpperCase()

  return (
    <article className="card w-[80vw] sm:w-96 lg:w-auto shrink-0 snap-start p-7 lg:p-8 flex flex-col">
      {/* Stars — strongest credibility signal, leads the card */}
      <div className="flex items-center gap-1 mb-4" aria-label={`Rated ${rating} out of 5`}>
        {Array.from({ length: rating }).map((_, i) => (
          <Star key={i} className="w-4 h-4 fill-lavender-pastel text-lavender-pastel" aria-hidden />
        ))}
      </div>
      <Quote className="w-6 h-6 text-lavender-pastel/70 mb-3" aria-hidden />
      <p className="font-serif text-lg lg:text-xl text-ivory leading-relaxed mb-6 flex-1">
        &ldquo;{quote}&rdquo;
      </p>
      <div className="pt-4 border-t border-lavender-soft/25 flex items-center gap-3">
        {/* Avatar initial circle */}
        <span
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center
                     text-sm font-bold text-white"
          style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)' }}
          aria-hidden
        >
          {initial}
        </span>
        <div>
          <p className="text-sm text-ivory font-semibold tracking-wide">{name}</p>
          <p className="text-xs text-ivory-mute mt-0.5 flex items-center gap-1.5">
            <span>{location}</span>
            <span className="w-1 h-1 rounded-full bg-lavender-pastel/60" aria-hidden />
            <span>{art}</span>
          </p>
        </div>
      </div>
    </article>
  )
}
