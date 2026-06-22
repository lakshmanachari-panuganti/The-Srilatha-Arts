'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { ChevronDown, Instagram, Facebook, Youtube, Mail, Send, CheckCircle2, MessageCircle, Phone } from 'lucide-react'
import { cn } from '@/lib/cn'
import { apiFetch, ApiError } from '@/lib/api'
import { CONTACT, waLink, mailtoLink } from '@/lib/site-config'
import PinterestIcon from '@/components/icons/PinterestIcon'

const columns = [
  {
    title: 'Collections',
    links: [
      { href: '/shop', label: 'All Collections' },
      { href: '/shop/resin', label: 'Resin Art' },
      { href: '/shop/dot-mandala', label: 'Dot Mandala' },
      { href: '/shop/lippan', label: 'Lippan Art' },
      { href: '/shop/kolam', label: 'Kolam Art' },
      { href: '/shop/wedding', label: 'Wedding Decoratives' },
    ],
  },
  {
    title: 'About',
    links: [
      { href: '/our-story', label: 'Our Story' },
      { href: '/the-craft', label: 'The Craft' },
      { href: '/reviews', label: 'Reviews' },
    ],
  },
  {
    title: 'Help',
    links: [
      { href: '/faq', label: 'FAQ' },
      { href: '/shipping-and-returns', label: 'Shipping & Returns' },
      { href: '/care-guide', label: 'Care Guide' },
      { href: '/contact', label: 'Contact' },
      { href: '/privacy-policy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
    ],
  },
] as const

export default function Footer() {
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [newsletterBusy, setNewsletterBusy] = useState(false)
  const [newsletterSubmitted, setNewsletterSubmitted] = useState(false)
  const [newsletterMessage, setNewsletterMessage] = useState(
    'Thanks — we will send a note when the studio newsletter launches.',
  )
  const [newsletterError, setNewsletterError] = useState('')

  return (
    <footer className="relative z-10 mt-24 border-t border-white/[0.06] bg-plum">
      {/* Soft aurora wash at the top of the footer */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-72 pointer-events-none opacity-60"
        style={{
          background:
            'radial-gradient(60% 80% at 50% 0%, rgba(59,130,246,0.12), transparent 70%)',
        }}
      />

      <div className="relative max-w-container mx-auto px-5 lg:px-8 py-16 lg:py-20">
        {/* Newsletter */}
        <div className="text-center max-w-2xl mx-auto mb-14 lg:mb-20">
          <p className="eyebrow justify-center mb-4">Stay in touch</p>
          <h3 className="font-display text-3xl lg:text-4xl text-ivory tracking-tight mb-3">
            Updates from the{' '}
            <span className="bg-gradient-to-r from-blue via-indigo to-cyan bg-clip-text text-transparent
                             drop-shadow-[0_0_18px_rgba(59,130,246,0.45)]">
              studio
            </span>
          </h3>
          <p className="text-ivory-soft text-sm lg:text-base mb-6">
            New pieces, studio updates and the occasional discount — sent straight to your inbox. No spam, ever.
          </p>
          {newsletterSubmitted ? (
            <div
              role="status"
              className="max-w-md mx-auto inline-flex items-center gap-2 text-sm text-blue text-center"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden />
              {newsletterMessage}
            </div>
          ) : (
            <form
              className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto"
              onSubmit={async (e) => {
                e.preventDefault()
                if (!newsletterEmail.trim()) return
                setNewsletterError('')
                setNewsletterBusy(true)
                try {
                  const res = await apiFetch<{ ok: true; message: string }>('/newsletter', {
                    method: 'POST',
                    body: { email: newsletterEmail.trim(), source: 'footer' },
                  })
                  setNewsletterMessage(res.message)
                  setNewsletterSubmitted(true)
                  setNewsletterEmail('')
                } catch (err) {
                  if (err instanceof ApiError && err.status === 429) {
                    setNewsletterError('Too many sign-ups from this network. Please try again later.')
                  } else if (err instanceof ApiError && err.status === 400) {
                    setNewsletterError('Please enter a valid email address.')
                  } else {
                    setNewsletterError(err instanceof Error ? err.message : 'Could not subscribe right now.')
                  }
                } finally {
                  setNewsletterBusy(false)
                }
              }}
            >
              <div className="relative flex-1">
                <Mail
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ivory-mute"
                  aria-hidden
                />
                <label htmlFor="newsletter-email" className="sr-only">Email address</label>
                <input
                  id="newsletter-email"
                  type="email"
                  required
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="your@email.com"
                  aria-label="Email address"
                  autoComplete="email"
                  className="w-full h-12 pl-11 pr-4 rounded-full
                             bg-plum-light text-ivory placeholder:text-ivory-mute
                             border border-white/10 hover:border-white/20
                             focus:border-blue focus:ring-4 focus:ring-blue/20 focus:outline-none
                             transition-all duration-200"
                />
              </div>
              <button type="submit" disabled={newsletterBusy} className="btn-dark whitespace-nowrap disabled:opacity-50">
                {newsletterBusy ? 'Subscribing…' : 'Subscribe'}
                {!newsletterBusy && <Send className="w-4 h-4" aria-hidden />}
              </button>
            </form>
          )}
          {newsletterError && (
            <p className="mt-2 text-xs text-red-600">{newsletterError}</p>
          )}
        </div>

        <div className="lg:grid lg:grid-cols-5 lg:gap-10 lg:items-start">
          <div className="hidden lg:block lg:col-span-2">
            <Link href="/" className="inline-flex items-center gap-3 mb-4">
              <Image src="/Logos/logo.png" alt="" width={48} height={48} className="w-12 h-12" />
              <span className="font-brand text-3xl text-ivory tracking-[0.04em]">
                Srilatha Art
              </span>
            </Link>
            <p className="text-sm text-ivory-soft leading-relaxed max-w-xs">
              Resin Art, Lippan Art, Kolam, Wedding Decor and Handmade Gifts — made by hand in Hyderabad.
            </p>

            <div className="mt-6 space-y-2.5 text-sm">
              <a
                href={waLink("Hi Srilatha Art, I'd like to know more about your work.")}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-ivory-soft hover:text-blue transition-colors duration-300"
              >
                <MessageCircle className="w-4 h-4 text-[#25D366]" aria-hidden />
                WhatsApp · {CONTACT.phoneDisplay}
              </a>
              <br />
              <a
                href={mailtoLink()}
                className="inline-flex items-center gap-2 text-ivory-soft hover:text-blue transition-colors duration-300"
              >
                <Mail className="w-4 h-4 text-blue" aria-hidden />
                {CONTACT.email}
              </a>
              <br />
              <a
                href={`tel:${CONTACT.phoneTel}`}
                className="inline-flex items-center gap-2 text-ivory-soft hover:text-blue transition-colors duration-300"
              >
                <Phone className="w-4 h-4 text-blue" aria-hidden />
                {CONTACT.phoneDisplay}
              </a>
            </div>

            <p className="mt-4 text-xs text-ivory-mute leading-relaxed">
              {CONTACT.studioAddress.line1}, {CONTACT.studioAddress.line2}<br />
              {CONTACT.studioAddress.city}, {CONTACT.studioAddress.country}
            </p>

            <div className="flex items-center gap-2 mt-6">
              <SocialLink href={CONTACT.social.instagram} label="Instagram">
                <Instagram className="w-4 h-4" aria-hidden />
              </SocialLink>
              <SocialLink href={CONTACT.social.pinterest} label="Pinterest">
                <PinterestIcon className="w-4 h-4" />
              </SocialLink>
              <SocialLink href={CONTACT.social.facebook} label="Facebook">
                <Facebook className="w-4 h-4" aria-hidden />
              </SocialLink>
              <SocialLink href={CONTACT.social.youtube} label="YouTube">
                <Youtube className="w-4 h-4" aria-hidden />
              </SocialLink>
            </div>
          </div>

          <div className="lg:col-span-3 lg:grid lg:grid-cols-3 lg:gap-8">
            {columns.map((col) => (
              <FooterColumn key={col.title} title={col.title} links={col.links} />
            ))}
          </div>
        </div>

        {/* Mobile brand + contact */}
        <div className="lg:hidden mt-12 pt-8 text-center border-t border-white/[0.06]">
          <Link href="/" className="inline-flex items-center gap-2 mb-3">
            <Image src="/Logos/logo.png" alt="" width={36} height={36} className="w-9 h-9" />
            <span className="font-brand text-3xl text-ivory tracking-[0.04em]">
              Srilatha Art
            </span>
          </Link>
          <div className="flex items-center justify-center gap-2 mt-2">
            <SocialLink href={CONTACT.social.instagram} label="Instagram">
              <Instagram className="w-4 h-4" aria-hidden />
            </SocialLink>
            <SocialLink href={CONTACT.social.pinterest} label="Pinterest">
              <PinterestIcon className="w-4 h-4" />
            </SocialLink>
            <SocialLink href={CONTACT.social.facebook} label="Facebook">
              <Facebook className="w-4 h-4" aria-hidden />
            </SocialLink>
            <SocialLink href={CONTACT.social.youtube} label="YouTube">
              <Youtube className="w-4 h-4" aria-hidden />
            </SocialLink>
          </div>

          <div className="mt-6 space-y-2 text-sm">
            <a
              href={waLink("Hi Srilatha Art, I'd like to know more about your work.")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-ivory-soft hover:text-blue transition-colors duration-300"
            >
              <MessageCircle className="w-4 h-4 text-[#25D366]" aria-hidden />
              WhatsApp · {CONTACT.phoneDisplay}
            </a>
            <br />
            <a
              href={mailtoLink()}
              className="inline-flex items-center gap-2 text-ivory-soft hover:text-blue transition-colors duration-300"
            >
              <Mail className="w-4 h-4 text-blue" aria-hidden />
              {CONTACT.email}
            </a>
            <br />
            <a
              href={`tel:${CONTACT.phoneTel}`}
              className="inline-flex items-center gap-2 text-ivory-soft hover:text-blue transition-colors duration-300"
            >
              <Phone className="w-4 h-4 text-blue" aria-hidden />
              {CONTACT.phoneDisplay}
            </a>
          </div>

          <p className="mt-4 text-xs text-ivory-mute leading-relaxed">
            {CONTACT.studioAddress.line1}, {CONTACT.studioAddress.line2}<br />
            {CONTACT.studioAddress.city}, {CONTACT.studioAddress.country}
          </p>
        </div>

        <div className="mt-12 pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-ivory-mute">
          <p>© {new Date().getFullYear()} Srilatha Art. All rights reserved.</p>
          <p className="font-serif italic text-base bg-gradient-to-r from-blue via-indigo to-cyan bg-clip-text text-transparent
                        drop-shadow-[0_0_14px_rgba(59,130,246,0.45)]">
            Handmade with care
          </p>
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({
  title,
  links,
}: {
  title: string
  links: readonly { href: string; label: string }[]
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="lg:py-0 border-b border-white/[0.06] lg:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="lg:pointer-events-none w-full flex items-center justify-between py-4 lg:py-0 lg:mb-4
                   text-[11px] uppercase tracking-[0.22em] font-bold text-ivory"
      >
        {title}
        <ChevronDown
          className={cn('w-4 h-4 lg:hidden transition-transform duration-300', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      <ul
        className={cn(
          'overflow-hidden lg:block lg:opacity-100 lg:max-h-none transition-all duration-300',
          open ? 'max-h-96 opacity-100 pb-4' : 'max-h-0 opacity-0 lg:opacity-100',
        )}
      >
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="block py-1.5 text-sm text-ivory-soft hover:text-blue transition-colors duration-300"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string
  label: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="min-w-10 min-h-10 rounded-full flex items-center justify-center
                 text-ivory-soft hover:text-blue
                 bg-white/[0.04] border border-white/10 hover:border-blue/50
                 hover:shadow-[0_0_16px_rgba(59,130,246,0.30)]
                 transition-all duration-300"
    >
      {children}
    </a>
  )
}
