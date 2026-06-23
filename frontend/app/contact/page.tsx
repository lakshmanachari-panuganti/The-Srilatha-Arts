import type { Metadata } from 'next'
import Link from 'next/link'
import { Mail, MessageCircle, Instagram, Clock, MapPin, Phone } from 'lucide-react'
import { CONTACT, waLink, mailtoLink } from '@/lib/site-config'
import PinterestIcon from '@/components/icons/PinterestIcon'

export const metadata: Metadata = {
  title: 'Contact us',
  description: 'Get in touch by WhatsApp, email or Instagram. We usually reply within a few hours.',
  alternates: { canonical: '/contact/' },
}

export default function ContactPage() {
  return (
    <main className="max-w-3xl mx-auto px-5 py-16 lg:py-24">
      <p className="eyebrow mb-3">Say hello</p>
      <h1 className="display text-4xl md:text-5xl lg:text-6xl mb-5">
        We&apos;d love to <em className="italic">hear from you</em>
      </h1>
      <p className="text-ivory-soft text-base lg:text-lg leading-relaxed mb-12">
        Question about a piece? Need help with an order? Want to discuss a custom idea? Reach out
        on any of these and we&apos;ll get back to you quickly.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        <ContactCard
          href={waLink("Hi Srilatha Art, I'd like to know more about your work.")}
          icon={MessageCircle}
          label="WhatsApp"
          value={CONTACT.phoneDisplay}
          note="Fastest way to reach us"
        />
        <ContactCard
          href={mailtoLink()}
          icon={Mail}
          label="Email"
          value={CONTACT.email}
          note="For detailed questions"
        />
        <ContactCard
          href={CONTACT.social.instagram}
          icon={Instagram}
          label="Instagram"
          value={CONTACT.instagramHandleAt}
          note="See work in progress"
        />
        <ContactCard
          href={CONTACT.social.pinterest}
          icon={PinterestIcon}
          label="Pinterest"
          value="@srilatha_art"
          note="Save and curate boards"
        />
        <ContactCard
          href={`tel:${CONTACT.phoneTel}`}
          icon={Phone}
          label="Phone"
          value={CONTACT.phoneDisplay}
          note={CONTACT.hours}
        />
        <Card icon={Clock} label="Hours" value={CONTACT.hours} note="We rest on Sundays" />
      </div>

      <div className="rounded-2xl border border-glass-border bg-plum-light/30 p-5 lg:p-6 flex items-start gap-3">
        <MapPin className="w-5 h-5 text-lavender-pastel shrink-0 mt-0.5" aria-hidden />
        <div>
          <p className="text-ivory font-medium mb-1">Studio address</p>
          <p className="text-ivory-soft text-sm leading-relaxed">
            {CONTACT.studioAddress.line1}, {CONTACT.studioAddress.line2}<br />
            {CONTACT.studioAddress.city}, {CONTACT.studioAddress.region}, {CONTACT.studioAddress.country}
          </p>
          <p className="text-ivory-mute text-xs leading-relaxed mt-2">
            We don&apos;t have a walk-in store — we create everything from this studio.
            To order, please use the website or message us. We ship anywhere in India.
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
