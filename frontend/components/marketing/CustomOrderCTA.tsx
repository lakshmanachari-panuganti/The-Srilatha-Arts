import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'

export default function CustomOrderCTA() {
  return (
    <section className="px-5 lg:px-8 py-20 lg:py-28">
      <div className="relative overflow-hidden max-w-6xl mx-auto text-center
                      p-10 sm:p-14 lg:p-20"
           style={{ borderRadius: '32px' }}
      >
        {/* Glassmorphism background */}
        <div className="absolute inset-0 glass-strong" />

        {/* Dreamy ambient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px]
                         rounded-full bg-lavender-soft/12 blur-[80px]" aria-hidden />
        <div className="absolute bottom-0 right-1/4 w-[300px] h-[200px]
                         rounded-full bg-lavender-pastel/8 blur-[60px]" aria-hidden />

        {/* Decorative mandala dot pattern */}
        <svg
          viewBox="0 0 600 300"
          className="absolute inset-0 w-full h-full text-lavender-pastel/8"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden
        >
          {Array.from({ length: 70 }).map((_, i) => {
            const a = (i / 70) * Math.PI * 2
            const r = 60 + (i % 5) * 28
            return (
              <circle
                key={i}
                cx={300 + Math.cos(a) * r}
                cy={150 + Math.sin(a) * r * 0.7}
                r="1.5"
                fill="currentColor"
              />
            )
          })}
        </svg>

        <div className="relative z-10">
          <span className="inline-flex items-center gap-2 text-[11px] tracking-[0.32em] uppercase text-lavender-pastel mb-5">
            <Sparkles className="w-3.5 h-3.5" aria-hidden />
            Custom Creations
            <Sparkles className="w-3.5 h-3.5" aria-hidden />
          </span>
          <h2 className="font-serif text-4xl sm:text-5xl lg:text-7xl leading-[1.02] text-ivory mb-4">
            Have a vision?
            <br />
            <em className="italic gold-text">We&apos;ll craft it.</em>
          </h2>
          <p className="text-ivory-soft/70 max-w-reader mx-auto text-base lg:text-lg leading-relaxed mb-8">
            Did you Dream it? then Describe it — the colours, the mood, the story it should whisper.
            Our hands will shape it into your own masterpiece within one to two weeks.
          </p>
          <Link
            href="/custom-order"
            className="btn-dark inline-flex"
          >
            Start your Custom Creations 
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  )
}
