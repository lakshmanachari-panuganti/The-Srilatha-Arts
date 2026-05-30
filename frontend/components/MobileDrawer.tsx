'use client'
import { Fragment } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { X, MessageCircle, Instagram } from 'lucide-react'
import { useUI } from '@/stores/ui'
import { useUserAuth } from '@/stores/userAuth'
import { CATEGORIES } from '@/data/categories'
import { SOCIAL, INSTAGRAM_HANDLE, whatsappLink } from '@/lib/site-config'

const primaryLinks = [
  { href: '/shop', label: 'Shop' },
  { href: '/custom-order', label: 'Custom orders' },
  { href: '/our-story', label: 'About us' },
  { href: '/contact', label: 'Contact' },
] as const

export default function MobileDrawer() {
  const open = useUI((s) => s.drawerOpen)
  const setOpen = useUI((s) => s.setDrawerOpen)
  const authUser = useUserAuth((s) => s.user)
  const logout = useUserAuth((s) => s.logout)

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
              background: 'rgba(76,29,149,0.95)',
              backdropFilter: 'blur(24px)',
              borderRight: '1px solid rgba(167,139,250,0.25)',
            }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4"
                 style={{
                   background: 'rgba(76,29,149,0.95)',
                   backdropFilter: 'blur(24px)',
                   borderBottom: '1px solid rgba(167,139,250,0.20)',
                 }}
            >
              <Link
                href="/"
                onClick={() => setOpen(false)}
                aria-label="Srilatha Art - home"
                className="flex items-center gap-2"
              >
                <Image src="/Logos/logo.png" alt="" width={40} height={40} className="w-10 h-10" />
                <span className="font-serif text-lg leading-none text-plum">
                  <span className="gold-text">Srilatha</span> Art
                </span>
              </Link>
              <div className="flex items-center gap-2">
                {authUser ? (
                  <button
                    onClick={() => { logout(); setOpen(false) }}
                    className="text-xs text-plum-warm hover:text-lavender-soft transition-colors duration-300 border border-white/10 rounded-full px-3 py-1"
                  >
                    Sign out
                  </button>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="text-xs text-plum-warm hover:text-lavender-soft transition-colors duration-300 border border-white/10 rounded-full px-3 py-1"
                  >
                    Sign in
                  </Link>
                )}
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="min-h-11 min-w-11 flex items-center justify-center
                             text-plum-warm hover:text-plum transition-colors duration-500"
                >
                  <X className="w-5 h-5" aria-hidden />
                </button>
              </div>
            </div>

            <nav className="px-5 py-8">
              <ul className="space-y-1 mb-10">
                {primaryLinks.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className="block py-3 font-serif text-3xl text-plum hover:text-lavender-soft transition-colors duration-500"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>

              <p className="eyebrow text-lavender-soft mb-3">Shop by style</p>
              <ul className="space-y-1 mb-10">
                {CATEGORIES.map((c) => (
                  <li key={c.slug}>
                    <Link
                      href={`/shop/${c.slug}`}
                      onClick={() => setOpen(false)}
                      className="block py-2 text-base text-plum-warm hover:text-lavender-soft transition-colors duration-500"
                    >
                      {c.title}
                    </Link>
                  </li>
                ))}
              </ul>

              <p className="eyebrow text-lavender-soft mb-3">Account</p>
              <ul className="space-y-1">
                {authUser ? (
                  <>
                    <li>
                      <Link
                        href="/account"
                        onClick={() => setOpen(false)}
                        className="block py-2 text-base text-plum-warm hover:text-lavender-soft transition-colors duration-500"
                      >
                        My Account ({authUser.name.split(' ')[0]})
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/account/wishlist"
                        onClick={() => setOpen(false)}
                        className="block py-2 text-base text-plum-warm hover:text-lavender-soft transition-colors duration-500"
                      >
                        Wishlist
                      </Link>
                    </li>
                    <li>
                      <button
                        onClick={() => { logout(); setOpen(false) }}
                        className="block py-2 text-base text-plum-warm hover:text-lavender-soft transition-colors duration-500 text-left w-full"
                      >
                        Sign out
                      </button>
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      <Link
                        href="/login"
                        onClick={() => setOpen(false)}
                        className="block py-2 text-base text-plum-warm hover:text-lavender-soft transition-colors duration-500"
                      >
                        Sign in
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/account/wishlist"
                        onClick={() => setOpen(false)}
                        className="block py-2 text-base text-plum-warm hover:text-lavender-soft transition-colors duration-500"
                      >
                        Wishlist
                      </Link>
                    </li>
                  </>
                )}
              </ul>
            </nav>

            <div className="px-5 py-6 mt-2 safe-pb"
                 style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
            >
              <a
                href={whatsappLink("Hi Srilatha Art, I'd like to know more about your work.")}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-dark w-full justify-center"
              >
                <MessageCircle className="w-4 h-4" aria-hidden />
                WhatsApp us
              </a>
              <a
                href={SOCIAL.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 text-sm text-plum-warm hover:text-lavender-soft transition-colors duration-500"
              >
                <Instagram className="w-4 h-4" aria-hidden />
                {INSTAGRAM_HANDLE}
              </a>
            </div>
          </motion.aside>
        </Fragment>
      )}
    </AnimatePresence>
  )
}
