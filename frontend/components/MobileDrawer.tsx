'use client'
import { Fragment } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { X, ChevronRight, MessageCircle } from 'lucide-react'
import { useUI } from '@/stores/ui'
import { CATEGORIES } from '@/data/categories'

const sections = [
  {
    title: 'Shop',
    links: [
      { href: '/shop', label: 'All Products' },
      ...CATEGORIES.map((c) => ({ href: `/shop/${c.slug}`, label: c.title })),
    ],
  },
  {
    title: 'Discover',
    links: [
      { href: '/new-arrivals', label: 'New Arrivals' },
      { href: '/best-sellers', label: 'Best Sellers' },
      { href: '/collections', label: 'Collections' },
      { href: '/sale', label: 'Sale' },
    ],
  },
  {
    title: 'The Craft',
    links: [
      { href: '/the-craft', label: "How It's Made" },
      { href: '/care-guide', label: 'Care Guide' },
      { href: '/our-story', label: 'Our Story' },
      { href: '/journal', label: 'Journal' },
    ],
  },
  {
    title: 'Help',
    links: [
      { href: '/faq', label: 'FAQ' },
      { href: '/shipping-and-returns', label: 'Shipping & Returns' },
      { href: '/contact', label: 'Contact' },
    ],
  },
  {
    title: 'My Account',
    links: [
      { href: '/account', label: 'Profile' },
      { href: '/account/orders', label: 'Orders' },
      { href: '/account/addresses', label: 'Addresses' },
      { href: '/login', label: 'Sign In' },
    ],
  },
] as const

export default function MobileDrawer() {
  const open = useUI((s) => s.drawerOpen)
  const setOpen = useUI((s) => s.setDrawerOpen)

  return (
    <AnimatePresence>
      {open && (
        <Fragment>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[70] bg-ink/70 backdrop-blur-sm"
            aria-hidden
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Main menu"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
            className="fixed top-0 bottom-0 left-0 z-[71] w-[88vw] max-w-sm
                       bg-primary-dark border-r border-gold/15 overflow-y-auto safe-pt"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4
                            bg-primary-dark/95 backdrop-blur-xl border-b border-gold/10">
              <Image
                src="/images/logo-horizontal.png"
                alt="The Srilatha Arts"
                width={130}
                height={32}
                className="h-7 w-auto"
              />
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="min-h-11 min-w-11 flex items-center justify-center
                           text-cream/70 hover:text-gold"
              >
                <X className="w-5 h-5" aria-hidden />
              </button>
            </div>

            <nav className="px-5 py-4 space-y-6">
              {sections.map((section) => (
                <div key={section.title}>
                  <p className="text-[11px] tracking-[0.25em] uppercase text-gold-light/60 mb-2">
                    {section.title}
                  </p>
                  <ul>
                    {section.links.map((l) => (
                      <li key={l.href}>
                        <Link
                          href={l.href}
                          onClick={() => setOpen(false)}
                          className="flex items-center justify-between py-3 -mx-2 px-2 rounded-lg
                                     text-cream/90 hover:bg-gold/5 hover:text-gold transition-colors"
                        >
                          <span className="text-[15px]">{l.label}</span>
                          <ChevronRight className="w-4 h-4 opacity-40" aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>

            <div className="px-5 py-6 mt-2 border-t border-gold/10 safe-pb">
              <a
                href="https://wa.me/919999999999"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline w-full justify-center text-cream border-cream/20"
              >
                <MessageCircle className="w-4 h-4" aria-hidden />
                WhatsApp Us
              </a>
            </div>
          </motion.aside>
        </Fragment>
      )}
    </AnimatePresence>
  )
}
