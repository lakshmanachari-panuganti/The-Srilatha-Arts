import type { Metadata } from 'next'
import Link from 'next/link'
import { Mail, MessageCircle, Instagram, Clock, MapPin } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Contact us',
  description: 'Get in touch by WhatsApp, email or Instagram. We usually reply within a few hours.',
}

export default function ContactPage() {
  return (
    <main className="max-w-3xl mx-auto px-5 py-16 lg:py-24">
      <p className="eyebrow mb-3">Say hello</p>
      <h1 className="display text-4xl md:text-5xl lg:text-6xl mb-5">
        We&apos;d love to <em className="italic gold-text">hear from you</em>
      </h1>
      <p className="text-ivory-soft text-base lg:text-lg leading-relaxed mb-12">
        Question about a piece? Need help with an order? Want to discuss a custom idea? Reach out
        on any of these and we&apos;ll get back to you quickly.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        <ContactCard
          href="https://wa.me/919133266754"
          icon={MessageCircle}
          label="WhatsApp"
          value="+91 91332 66754"
          note="Fastest way to reach us"
        />
        <ContactCard
          href="mailto:studio@srilatha.art"
          icon={Mail}
          label="Email"
          value="studio@srilatha.art"
          note="For detailed questions"
        />
        <ContactCard
          href="https://instagram.com/thesrilathaarts"
          icon={Instagram}
          label="Instagram"
          value="@thesrilathaarts"
          note="See work in progress"
        />
        <Card icon={Clock} label="Hours" value="Mon–Sat, 10 am – 7 pm" note="We rest on Sundays" />
      </div>

      <div className="rounded-2xl border border-glass-border bg-plum-light/30 p-5 lg:p-6 flex items-start gap-3">
        <MapPin className="w-5 h-5 text-lavender-pastel shrink-0 mt-0.5" aria-hidden />
        <div>
          <p className="text-ivory font-medium mb-1">We don&apos;t have a walk-in store</p>
          <p className="text-ivory-soft text-sm leading-relaxed">
            We work out of a small home studio in Hyderabad. To order, please use the website or
            message us — we ship anywhere in India.
          </p>
        </div>
      </div>

      <p className="text-ivory-soft text-base mt-12">
        Looking for a custom piece? <Link href="/custom-order" className="text-lavender-pastel hover:underline">Start a custom order</Link> instead.
      </p>
    </main>
  )
}

function ContactCard({
  href, icon: Icon, label, value, note,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  note: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-2xl border border-glass-border bg-plum-light/30 hover:bg-plum-light/50 transition-colors p-5"
    >
      <div className="flex items-center gap-3 mb-2">
        <span className="w-9 h-9 rounded-full bg-lavender-pastel/20 text-lavender-pastel flex items-center justify-center">
          <Icon className="w-4 h-4" />
        </span>
        <p className="text-[11px] uppercase tracking-wider text-ivory-mute">{label}</p>
      </div>
      <p className="font-medium text-ivory">{value}</p>
      <p className="text-xs text-ivory-mute mt-1">{note}</p>
    </a>
  )
}

function Card({
  icon: Icon, label, value, note,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  note: string
}) {
  return (
    <div className="block rounded-2xl border border-glass-border bg-plum-light/30 p-5">
      <div className="flex items-center gap-3 mb-2">
        <span className="w-9 h-9 rounded-full bg-lavender-pastel/20 text-lavender-pastel flex items-center justify-center">
          <Icon className="w-4 h-4" />
        </span>
        <p className="text-[11px] uppercase tracking-wider text-ivory-mute">{label}</p>
      </div>
      <p className="font-medium text-ivory">{value}</p>
      <p className="text-xs text-ivory-mute mt-1">{note}</p>
    </div>
  )
}
