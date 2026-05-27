import type { Metadata } from 'next'
import Link from 'next/link'
import { MessageCircle, Mail, ArrowRight, Palette, Ruler, Clock } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Custom orders',
  description: 'Tell us what you want and we’ll make it just for you. Delivery in 1–2 weeks.',
}

export default function CustomOrderPage() {
  return (
    <main className="max-w-3xl mx-auto px-5 py-16 lg:py-24">
      <p className="eyebrow mb-3">Custom orders</p>
      <h1 className="display text-4xl md:text-5xl lg:text-6xl mb-5">
        Made <em className="italic gold-text">just for you</em>
      </h1>
      <p className="text-ivory-soft text-base lg:text-lg leading-relaxed mb-10">
        Have a specific size, colour or theme in mind? Tell us about it and we&apos;ll make a one-of-a-kind
        piece for you. Great for birthdays, anniversaries, housewarmings, or any occasion.
      </p>

      {/* How it works */}
      <section className="mb-12">
        <h2 className="font-serif text-2xl lg:text-3xl text-ivory mb-5">How it works</h2>
        <ol className="space-y-4">
          <Step n={1} title="Share your idea">
            Send us a WhatsApp or email with the size, art style, colours and any photos for reference.
          </Step>
          <Step n={2} title="Get a price and timeline">
            We&apos;ll reply with the price and how long it&apos;ll take — usually 1–2 weeks.
          </Step>
          <Step n={3} title="Approve and pay">
            Once you say yes, pay a 50% advance to start the work. The rest is paid before shipping.
          </Step>
          <Step n={4} title="See it before it ships">
            We send you a photo of the finished piece. If anything needs a small change, we&apos;ll fix it.
          </Step>
          <Step n={5} title="Delivered to your door">
            Carefully packed, shipped, and tracked all the way to you.
          </Step>
        </ol>
      </section>

      {/* What to share */}
      <section className="mb-12">
        <h2 className="font-serif text-2xl lg:text-3xl text-ivory mb-5">What to share with us</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Info icon={Palette} title="Style & colours" body="Resin, Dot Mandala, Lippan, Kolam or Wedding Decoratives — and your colour preferences." />
          <Info icon={Ruler} title="Size" body="The size in inches or where you plan to hang it (a photo of the wall helps a lot)." />
          <Info icon={Clock} title="Deadline" body="Tell us if you need it by a specific date so we can plan around it." />
        </div>
      </section>

      <div className="rounded-2xl border border-glass-border bg-plum-light/30 p-6 lg:p-8 text-center">
        <h2 className="font-serif text-2xl lg:text-3xl text-ivory mb-3">Ready to start?</h2>
        <p className="text-ivory-soft mb-6">Reach out on whichever is easiest for you.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a href="https://wa.me/919133266754" target="_blank" rel="noopener noreferrer" className="btn-dark">
            <MessageCircle className="w-4 h-4" aria-hidden />
            WhatsApp us
          </a>
          <a href="mailto:studio@srilatha.art" className="btn-outline">
            <Mail className="w-4 h-4" aria-hidden />
            Email us
          </a>
        </div>
      </div>

      <p className="text-ivory-soft text-sm text-center mt-8">
        Prefer to browse first? <Link href="/shop" className="text-lavender-pastel hover:underline inline-flex items-center gap-1">See our ready-made pieces <ArrowRight className="w-3.5 h-3.5" aria-hidden /></Link>
      </p>
    </main>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="shrink-0 w-8 h-8 rounded-full bg-lavender-pastel/20 text-lavender-pastel flex items-center justify-center text-sm font-medium">
        {n}
      </span>
      <div>
        <p className="font-medium text-ivory">{title}</p>
        <p className="text-ivory-soft text-base leading-relaxed mt-1">{children}</p>
      </div>
    </li>
  )
}

function Info({
  icon: Icon, title, body,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  body: string
}) {
  return (
    <div className="rounded-2xl border border-glass-border bg-plum-light/20 p-5">
      <Icon className="w-5 h-5 text-lavender-pastel mb-2" aria-hidden />
      <p className="font-medium text-ivory mb-1">{title}</p>
      <p className="text-sm text-ivory-soft leading-relaxed">{body}</p>
    </div>
  )
}
