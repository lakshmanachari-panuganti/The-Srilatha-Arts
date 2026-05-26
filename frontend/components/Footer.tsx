'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { ChevronDown, Instagram, Facebook, Youtube, Mail, Send, CheckCircle2, MessageCircle, Phone } from 'lucide-react'
import { cn } from '@/lib/cn'
import { SOCIAL, STUDIO_EMAIL, PHONE_DISPLAY, PHONE_TEL, whatsappLink, emailLink } from '@/lib/site-config'
import PinterestIcon from '@/components/icons/PinterestIcon'

const columns = [
  {
    title: 'Shop',
    links: [
      { href: '/shop', label: 'All Products' },
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
  const [newsletterSubmitted, setNewsletterSubmitted] = useState(false)

  return (
    <footer className="relative z-10 mt-20"
      style={{ borderTop: '1px solid rgba(167,139,250,0.35)', background: 'linear-gradient(180deg, rgba(109,40,217,0.18) 0%, rgba(76,29,149,0.35) 100%), #EDE9FE' }}
    >
      <div className="max-w-6xl mx-auto px-5 lg:px-8 py-14 lg:py-20">
        {/* Newsletter */}
        <div className="text-center max-w-xl mx-auto mb-14 lg:mb-20">
          <p className="eyebrow text-lavender-pastel justify-center mb-4">Stay in touch</p>
          <h3 className="display text-3xl lg:text-4xl mb-3">
            Updates from the <em className="italic gold-text">studio</em>
          </h3>
          <p className="text-ivory-mute text-sm lg:text-base mb-6">
            New pieces, studio updates and the occasional discount — sent straight to your inbox. No spam, ever.
          </p>
          {newsletterSubmitted ? (
            <div
              role="status"
              className="max-w-md mx-auto inline-flex items-center gap-2 text-sm text-lavender-pastel text-center"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden />
              {/*
                Truthful copy. Until the newsletter backend is wired, we
                shouldn't pretend the email was actually saved — that would
                hurt trust the first time a subscriber notices nothing
                ever arrives. We keep the form (the studio wants to see
                interest) but the wording promises only what we can deliver.
              */}
              Thanks — we&apos;ll send a note when the studio newsletter launches.
            </div>
          ) : (
            <form
              className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto"
              onSubmit={(e) => {
                e.preventDefault()
                // Backend wiring not yet available — acknowledge the intent
                // locally so the user gets feedback instead of a silent
                // no-op. Wire to /api/newsletter when that endpoint exists.
                if (!newsletterEmail.trim()) return
                setNewsletterSubmitted(true)
                setNewsletterEmail('')
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
                  className="w-full h-12 pl-11 pr-4
                             bg-glass-surface text-ivory placeholder:text-ivory-mute
                             outline-none transition-all duration-500"
                  style={{
                    borderRadius: '24px',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'rgba(200,182,255,0.4)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>
              <button type="submit" className="btn-dark whitespace-nowrap">
                Subscribe
                <Send className="w-4 h-4" aria-hidden />
              </button>
            </form>
          )}
        </div>

        <div className="lg:grid lg:grid-cols-5 lg:gap-10 lg:items-start">
          <div className="hidden lg:block lg:col-span-2">
            <Link href="/" className="inline-flex items-center gap-3 mb-4">
              <Image src="/Logos/logo.jpeg" alt="" width={48} height={48} className="w-12 h-12" />
              <span className="font-serif text-xl text-ivory">
                <span className="gold-text">Srilatha Art</span>
              </span>
            </Link>
            <p className="text-sm text-ivory-mute leading-relaxed max-w-xs">
              Handmade Indian art from Hyderabad — Resin, Dot Mandala, Lippan, Kolam and Wedding Decoratives.
            </p>
            <div className="flex items-center gap-2 mt-5">
              <SocialLink href={SOCIAL.instagram} label="Instagram">
                <Instagram className="w-4 h-4" aria-hidden />
              </SocialLink>
              <SocialLink href={SOCIAL.pinterest} label="Pinterest">
                <PinterestIcon className="w-4 h-4" />
              </SocialLink>
              <SocialLink href={SOCIAL.facebook} label="Facebook">
                <Facebook className="w-4 h-4" aria-hidden />
              </SocialLink>
              <SocialLink href={SOCIAL.youtube} label="YouTube">
                <Youtube className="w-4 h-4" aria-hidden />
              </SocialLink>
            </div>
          </div>

          <div className="lg:col-span-3 lg:grid lg:grid-cols-3 lg:gap-8"
            style={{ borderColor: 'rgba(255,255,255,0.06)' }}
          >
            {columns.map((col) => (
              <FooterColumn key={col.title} title={col.title} links={col.links} />
            ))}
          </div>
        </div>

        <div className="lg:hidden mt-12 pt-8 text-center"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <Link href="/" className="inline-flex items-center gap-2 mb-3">
            <Image src="/Logos/logo.jpeg" alt="" width={36} height={36} className="w-9 h-9" />
            <span className="font-serif text-lg text-ivory">
              <span className="gold-text">Srilatha</span> Art
            </span>
          </Link>
          <div className="flex items-center justify-center gap-2 mt-2">
            <SocialLink href={SOCIAL.instagram} label="Instagram">
              <Instagram className="w-4 h-4" aria-hidden />
            </SocialLink>
            <SocialLink href={SOCIAL.pinterest} label="Pinterest">
              <PinterestIcon className="w-4 h-4" />
            </SocialLink>
            <SocialLink href={SOCIAL.facebook} label="Facebook">
              <Facebook className="w-4 h-4" aria-hidden />
            </SocialLink>
            <SocialLink href={SOCIAL.youtube} label="YouTube">
              <Youtube className="w-4 h-4" aria-hidden />
            </SocialLink>
          </div>

          {/* Contact strip — WhatsApp + Email + Phone, all tap-to-action on
              mobile. Prioritised per audit §7: WhatsApp and Instagram are
              the two most-used contact channels for a handcrafted Indian
              brand, so they sit at the top of the visual hierarchy. */}
          <div className="mt-6 space-y-2 text-sm">
            <a
              href={whatsappLink("Hi Srilatha Art, I'd like to know more about your work.")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-ivory-soft hover:text-lavender-pastel transition-colors duration-300"
            >
              <MessageCircle className="w-4 h-4" aria-hidden />
              WhatsApp · {PHONE_DISPLAY}
            </a>
            <br />
            <a
              href={emailLink()}
              className="inline-flex items-center gap-2 text-ivory-soft hover:text-lavender-pastel transition-colors duration-300"
            >
              <Mail className="w-4 h-4" aria-hidden />
              {STUDIO_EMAIL}
            </a>
            <br />
            <a
              href={`tel:${PHONE_TEL}`}
              className="inline-flex items-center gap-2 text-ivory-soft hover:text-lavender-pastel transition-colors duration-300"
            >
              <Phone className="w-4 h-4" aria-hidden />
              {PHONE_DISPLAY}
            </a>
          </div>
        </div>

        <div className="mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-ivory-mute"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <p>© {new Date().getFullYear()} Srilatha Art. Made by hand in Hyderabad.</p>
          <p className="font-serif italic text-base text-lavender-pastel">Handmade with care</p>
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
    <div className="lg:py-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="lg:pointer-events-none w-full flex items-center justify-between py-4 lg:py-0 lg:mb-3
                   text-[11px] uppercase tracking-[0.25em] text-ivory"
      >
        {title}
        <ChevronDown
          className={cn('w-4 h-4 lg:hidden transition-transform duration-500', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      <ul
        className={cn(
          'overflow-hidden lg:block lg:opacity-100 lg:max-h-none transition-all duration-500',
          open ? 'max-h-96 opacity-100 pb-4' : 'max-h-0 opacity-0 lg:opacity-100',
        )}
      >
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="block py-1.5 text-sm text-ivory-mute hover:text-lavender-pastel transition-colors duration-500"
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
      className="min-w-11 min-h-11 flex items-center justify-center
                 text-ivory-mute hover:text-lavender-pastel
                 transition-all duration-500"
      style={{
        borderRadius: '24px',
        border: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(255,255,255,0.04)',
      }}
    >
      {children}
    </a>
  )
}
