'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { ChevronDown, Instagram, Facebook, Youtube, Mail, Send, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/cn'

const columns = [
  {
    title: 'Shop',
    links: [
      { href: '/shop', label: 'All Products' },
      { href: '/shop/resin', label: 'Resin Art' },
      { href: '/shop/dot-mandala', label: 'Dot Mandala' },
      { href: '/shop/lippan', label: 'Lippan Art' },
      { href: '/shop/pichwai', label: 'Wedding & Festive Decor' },
      { href: '/shop/kolam', label: 'Kolam Art' },
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
    <footer
      className="relative z-10 mt-20 border-t border-purple-200"
      style={{
        background: 'linear-gradient(180deg, rgba(243, 232, 255, 0.4) 0%, rgba(233, 213, 255, 0.7) 100%)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div className="max-w-6xl mx-auto px-5 lg:px-8 py-14 lg:py-20">
        {/* Newsletter */}
        <div className="text-center max-w-xl mx-auto mb-16 lg:mb-24 card p-8 lg:p-10 border border-purple-200/50 bg-white/70">
          <p className="eyebrow justify-center mb-4">Stay in touch</p>
          <h3 className="display text-3xl lg:text-4xl mb-3">
            Updates from the <em className="italic gold-text">studio</em>
          </h3>
          <p className="text-purple-900 text-sm lg:text-base mb-6 leading-relaxed">
            New pieces, studio updates, and the occasional discount — sent straight to your inbox. No spam, ever.
          </p>
          {newsletterSubmitted ? (
            <div
              role="status"
              className="max-w-md mx-auto inline-flex items-center gap-2 text-sm font-bold text-pink-600 bg-pink-50 px-4 py-2.5 rounded-full border border-pink-100"
            >
              <CheckCircle2 className="w-4 h-4" aria-hidden />
              Thank you — we&apos;ll be in touch.
            </div>
          ) : (
            <form
              className="flex flex-col sm:flex-row gap-2.5 max-w-md mx-auto"
              onSubmit={(e) => {
                e.preventDefault()
                if (!newsletterEmail.trim()) return
                setNewsletterSubmitted(true)
                setNewsletterEmail('')
              }}
            >
              <div className="relative flex-1">
                <Mail
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-700"
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
                  className="w-full h-12 pl-11 pr-4 rounded-full border border-purple-200 bg-white/80 text-purple-950 placeholder:text-purple-700/50 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all duration-300"
                />
              </div>
              <button type="submit" className="btn-dark whitespace-nowrap">
                Subscribe
                <Send className="w-4 h-4" aria-hidden />
              </button>
            </form>
          )}
        </div>

        <div className="lg:grid lg:grid-cols-5 lg:gap-10 lg:items-start pt-10 border-t border-purple-200/50">
          <div className="hidden lg:block lg:col-span-2">
            <Link href="/" className="inline-flex items-center gap-3 mb-5 group">
              <div className="relative w-12 h-12 flex items-center justify-center rounded-full bg-purple-950 border border-purple-300/30 overflow-hidden shadow-sm group-hover:scale-105 transition-all duration-300">
                <Image src="/images/logo.png" alt="" width={40} height={40} className="w-9 h-9 object-contain" />
              </div>
              <span className="font-serif text-xl font-bold text-purple-950">
                <span className="gold-text">Srilatha Art</span>
              </span>
            </Link>
            <p className="text-sm text-purple-900 leading-relaxed max-w-xs">
              Handmade Indian art from Hyderabad - Resin, Dot Mandala, Lippan, Wedding Decoratives, and Kolam styles.
            </p>
            <div className="flex items-center gap-2 mt-6">
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

          <div className="lg:col-span-3 lg:grid lg:grid-cols-3 lg:gap-8">
            {columns.map((col) => (
              <FooterColumn key={col.title} title={col.title} links={col.links} />
            ))}
          </div>
        </div>

        <div className="lg:hidden mt-12 pt-8 text-center border-t border-purple-200/30">
          <Link href="/" className="inline-flex items-center gap-3 mb-4 group">
            <div className="relative w-10 h-10 flex items-center justify-center rounded-full bg-purple-950 border border-purple-300/20 overflow-hidden shadow-sm">
              <Image src="/images/logo.png" alt="" width={32} height={32} className="w-7 h-7 object-contain" />
            </div>
            <span className="font-serif text-lg font-bold text-purple-950">
              <span className="gold-text">Srilatha Art</span>
            </span>
          </Link>
          <div className="flex items-center justify-center gap-2.5 mt-2">
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

        <div className="mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-purple-900 border-t border-purple-200/30">
          <p>© {new Date().getFullYear()} Srilatha Art. Made by hand in Hyderabad.</p>
          <p className="font-hand text-xl text-pink-500 font-bold">Handmade with care</p>
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
    <div className="lg:py-0 border-b border-purple-200/30 lg:border-none">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="lg:pointer-events-none w-full flex items-center justify-between py-4 lg:py-0 lg:mb-4
                   text-xs font-bold uppercase tracking-[0.2em] text-purple-950"
      >
        {title}
        <ChevronDown
          className={cn('w-4 h-4 lg:hidden transition-transform duration-300 text-purple-900', open && 'rotate-180')}
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
              className="block py-2 text-sm text-purple-900 hover:text-pink-500 transition-colors duration-300"
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
      className="min-w-10 h-10 flex items-center justify-center rounded-full
                 text-purple-900 hover:text-pink-500 hover:border-pink-300 hover:bg-pink-50
                 border border-purple-200 bg-white/40 backdrop-blur-sm
                 transition-all duration-300"
    >
      {children}
    </a>
  )
}
