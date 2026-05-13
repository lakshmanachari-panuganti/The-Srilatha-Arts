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
            transition={{ duration: 0.35 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[70] bg-plum/60 backdrop-blur-sm"
            aria-hidden
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Main menu"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed top-0 bottom-0 left-0 z-[71] w-[86vw] max-w-sm
                       overflow-y-auto safe-pt"
            style={{
              background: 'rgba(43,30,52,0.95)',
              backdropFilter: 'blur(24px)',
              borderRight: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4"
                 style={{
                   background: 'rgba(43,30,52,0.95)',
                   backdropFilter: 'blur(24px)',
                   borderBottom: '1px solid rgba(255,255,255,0.06)',
                 }}
            >
              <Link
                href="/"
                onClick={() => setOpen(false)}
                aria-label="Srilatha Art - home"
                className="flex items-center gap-2"
              >
                <Image src="/images/logo.png" alt="" width={40} height={40} className="w-10 h-10" />
                <span className="font-serif text-lg leading-none text-ivory">
                  The <span className="gold-text">Srilatha</span> Arts
                </span>
              </Link>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="min-h-11 min-w-11 flex items-center justify-center
                           text-ivory-mute hover:text-ivory transition-colors duration-500"
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
                      className="block py-3 font-serif text-3xl text-ivory hover:text-lavender-pastel transition-colors duration-500"
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
                      className="block py-2 text-base text-ivory-mute hover:text-lavender-pastel transition-colors duration-500"
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
                    className="block py-2 text-base text-ivory-mute hover:text-lavender-pastel transition-colors duration-500"
                  >
                    Sign in
                  </Link>
                </li>
                <li>
                  <Link
                    href="/account/wishlist"
                    onClick={() => setOpen(false)}
                    className="block py-2 text-base text-ivory-mute hover:text-lavender-pastel transition-colors duration-500"
                  >
                    Wishlist
                  </Link>
                </li>
              </ul>
            </nav>

            <div className="px-5 py-6 mt-2 safe-pb"
                 style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
            >
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
                className="mt-3 inline-flex items-center gap-2 text-sm text-ivory-mute hover:text-lavender-pastel transition-colors duration-500"
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
