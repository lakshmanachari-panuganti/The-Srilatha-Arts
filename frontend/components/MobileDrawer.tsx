'use client'
import { Fragment } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { X, MessageCircle, Instagram } from 'lucide-react'
import { useUI } from '@/stores/ui'
import { CATEGORIES } from '@/data/categories'

const primaryLinks = [
  { href: '/shop', label: 'Shop' },
  { href: '/custom-order', label: 'Custom Order' },
  { href: '/our-story', label: 'Our Story' },
  { href: '/contact', label: 'Contact' },
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
            className="fixed inset-0 z-[70] bg-ink/40 backdrop-blur-sm"
            aria-hidden
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Main menu"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.34, ease: [0.32, 0.72, 0, 1] }}
            className="fixed top-0 bottom-0 left-0 z-[71] w-[86vw] max-w-sm
                       bg-cream border-r border-ink/8 overflow-y-auto safe-pt"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4
                            bg-cream/95 backdrop-blur-xl border-b border-ink/8">
              <Link
                href="/"
                onClick={() => setOpen(false)}
                aria-label="The Srilatha Arts — home"
                className="flex items-center gap-2"
              >
                <Image src="/images/logo.png" alt="" width={40} height={40} className="w-10 h-10" />
                <span className="font-serif text-lg leading-none text-ink">
                  The <span className="terracotta-text">Srilatha</span> Arts
                </span>
              </Link>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="min-h-11 min-w-11 flex items-center justify-center
                           text-ink-mute hover:text-ink"
              >
                <X className="w-5 h-5" aria-hidden />
              </button>
            </div>

            <nav className="px-5 py-8">
              <ul className="space-y-1 mb-10">
                {primaryLinks.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className="block py-3 font-serif text-3xl text-ink hover:text-terracotta transition-colors"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>

              <p className="eyebrow mb-3">By art form</p>
              <ul className="space-y-1 mb-10">
                {CATEGORIES.map((c) => (
                  <li key={c.slug}>
                    <Link
                      href={`/shop/${c.slug}`}
                      onClick={() => setOpen(false)}
                      className="block py-2 text-base text-ink-soft hover:text-terracotta transition-colors"
                    >
                      {c.title}
                    </Link>
                  </li>
                ))}
              </ul>

              <p className="eyebrow mb-3">Account</p>
              <ul className="space-y-1">
                <li>
                  <Link
                    href="/account"
                    onClick={() => setOpen(false)}
                    className="block py-2 text-base text-ink-soft hover:text-terracotta transition-colors"
                  >
                    Sign in
                  </Link>
                </li>
                <li>
                  <Link
                    href="/account/wishlist"
                    onClick={() => setOpen(false)}
                    className="block py-2 text-base text-ink-soft hover:text-terracotta transition-colors"
                  >
                    Wishlist
                  </Link>
                </li>
              </ul>
            </nav>

            <div className="px-5 py-6 mt-2 border-t border-ink/8 safe-pb">
              <a
                href="https://wa.me/919999999999"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-dark w-full justify-center"
              >
                <MessageCircle className="w-4 h-4" aria-hidden />
                WhatsApp us
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 text-sm text-ink-mute hover:text-terracotta"
              >
                <Instagram className="w-4 h-4" aria-hidden />
                @thesrilathaarts
              </a>
            </div>
          </motion.aside>
        </Fragment>
      )}
    </AnimatePresence>
  )
}
