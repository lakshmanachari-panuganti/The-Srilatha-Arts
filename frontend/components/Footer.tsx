'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { ChevronDown, Instagram, Facebook, Youtube, Mail, Send } from 'lucide-react'
import { cn } from '@/lib/cn'

const columns = [
  {
    title: 'Shop',
    links: [
      { href: '/shop', label: 'All Products' },
      { href: '/shop/resin', label: 'Resin Art' },
      { href: '/shop/dot-mandala', label: 'Dot Mandala' },
      { href: '/shop/lippan', label: 'Lippan Art' },
      { href: '/shop/pichwai', label: 'Pichwai Art' },
      { href: '/shop/kolam', label: 'Kolam Art' },
    ],
  },
  {
    title: 'Discover',
    links: [
      { href: '/new-arrivals', label: 'New Arrivals' },
      { href: '/best-sellers', label: 'Best Sellers' },
      { href: '/collections', label: 'Collections' },
      { href: '/sale', label: 'Sale' },
      { href: '/custom-order', label: 'Custom Order' },
    ],
  },
  {
    title: 'About',
    links: [
      { href: '/our-story', label: 'Our Story' },
      { href: '/the-craft', label: 'The Craft' },
      { href: '/journal', label: 'Journal' },
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
  return (
    <footer className="relative z-10 border-t border-gold/15 bg-primary-dark/40 mt-16">
      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-10 lg:py-16">
        {/* Newsletter */}
        <div className="text-center max-w-xl mx-auto mb-10 lg:mb-14">
          <p className="text-[11px] uppercase tracking-[0.3em] text-gold-light/70 mb-3">
            Join the circle
          </p>
          <h3 className="font-serif text-2xl lg:text-3xl mb-3">
            Stories from the <span className="gold-text">studio</span>
          </h3>
          <p className="text-cream/60 text-sm lg:text-base mb-5">
            New collections, behind-the-scenes craft notes, and the occasional discount. No spam.
          </p>
          <form
            className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto"
            onSubmit={(e) => e.preventDefault()}
          >
            <div className="relative flex-1">
              <Mail
                className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-cream/40"
                aria-hidden
              />
              <input
                type="email"
                required
                placeholder="your@email.com"
                aria-label="Email address"
                className="w-full h-12 pl-11 pr-4 rounded-full
                           bg-cream/5 border border-gold/20 focus:border-gold
                           text-cream placeholder:text-cream/40 outline-none transition-colors"
              />
            </div>
            <button type="submit" className="btn-gold whitespace-nowrap">
              Subscribe
              <Send className="w-4 h-4" aria-hidden />
            </button>
          </form>
        </div>

        {/* Mobile: accordions / Desktop: columns */}
        <div className="lg:grid lg:grid-cols-5 lg:gap-10 lg:items-start">
          <div className="hidden lg:block">
            <Image
              src="/images/logo-horizontal.png"
              alt="The Srilatha Arts"
              width={180}
              height={48}
              className="h-9 w-auto mb-4"
            />
            <p className="text-sm text-cream/55 leading-relaxed">
              Handcrafted folk art from Hyderabad — Resin, Dot Mandala, Lippan, Pichwai, Kolam.
            </p>
            <div className="flex items-center gap-2 mt-5">
              <SocialLink href="https://instagram.com" label="Instagram">
                <Instagram className="w-4 h-4" aria-hidden />
              </SocialLink>
              <SocialLink href="https://facebook.com" label="Facebook">
                <Facebook className="w-4 h-4" aria-hidden />
              </SocialLink>
              <SocialLink href="https://youtube.com" label="YouTube">
                <Youtube className="w-4 h-4" aria-hidden />
              </SocialLink>
            </div>
          </div>

          <div className="lg:col-span-4 lg:grid lg:grid-cols-4 lg:gap-8 divide-y divide-gold/10 lg:divide-y-0">
            {columns.map((col) => (
              <FooterColumn key={col.title} title={col.title} links={col.links} />
            ))}
          </div>
        </div>

        {/* Mobile-only socials + logo */}
        <div className="lg:hidden mt-10 pt-8 border-t border-gold/10 text-center">
          <Image
            src="/images/logo-horizontal.png"
            alt="The Srilatha Arts"
            width={160}
            height={40}
            className="h-8 w-auto mx-auto mb-4 opacity-90"
          />
          <div className="flex items-center justify-center gap-2">
            <SocialLink href="https://instagram.com" label="Instagram">
              <Instagram className="w-4 h-4" aria-hidden />
            </SocialLink>
            <SocialLink href="https://facebook.com" label="Facebook">
              <Facebook className="w-4 h-4" aria-hidden />
            </SocialLink>
            <SocialLink href="https://youtube.com" label="YouTube">
              <Youtube className="w-4 h-4" aria-hidden />
            </SocialLink>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gold/10 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-cream/45">
          <p>© {new Date().getFullYear()} The Srilatha Arts. Made by hand in Hyderabad.</p>
          <p className="font-hand text-base text-gold-light/70">Where Tradition Meets Creativity</p>
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
    <div className="lg:py-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="lg:pointer-events-none w-full flex items-center justify-between py-4 lg:py-0 lg:mb-3
                   text-[11px] uppercase tracking-[0.25em] text-gold-light/70"
      >
        {title}
        <ChevronDown
          className={cn('w-4 h-4 lg:hidden transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      <ul
        className={cn(
          'overflow-hidden lg:block lg:opacity-100 lg:max-h-none transition-all',
          open ? 'max-h-96 opacity-100 pb-4' : 'max-h-0 opacity-0 lg:opacity-100',
        )}
      >
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="block py-1.5 text-sm text-cream/70 hover:text-gold transition-colors"
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
      className="min-w-11 min-h-11 flex items-center justify-center rounded-full
                 border border-gold/20 text-cream/70 hover:text-gold hover:border-gold/50
                 transition-colors"
    >
      {children}
    </a>
  )
}
