'use client'
import { Fragment } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { X, MessageCircle, Instagram } from 'lucide-react'
import { useUI } from '@/stores/ui'
import { useUserAuth } from '@/stores/userAuth'
import { CATEGORIES } from '@/data/categories'

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
            className="fixed inset-0 z-[70] bg-purple-950/40 backdrop-blur-sm"
            aria-hidden
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Main menu"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-0 bottom-0 left-0 z-[71] w-[86vw] max-w-sm
                       overflow-y-auto safe-pt flex flex-col justify-between"
            style={{
              background: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(24px)',
              borderRight: '1px solid rgba(139, 92, 246, 0.15)',
            }}
          >
            <div>
              {/* Header */}
              <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-purple-100 bg-white/80 backdrop-blur-md">
                <Link
                  href="/"
                  onClick={() => setOpen(false)}
                  aria-label="Srilatha Art - home"
                  className="flex items-center gap-2 group"
                >
                  <div className="relative w-9 h-9 flex items-center justify-center rounded-full bg-purple-950 border border-purple-300/20 overflow-hidden shadow-sm">
                    <Image src="/images/logo.png" alt="" width={28} height={28} className="w-6 h-6 object-contain" />
                  </div>
                  <span className="font-serif text-base font-bold text-purple-950">
                    <span className="gold-text">Srilatha</span> Art
                  </span>
                </Link>
                <div className="flex items-center gap-1">
                  {authUser ? (
                    <button
                      onClick={() => { logout(); setOpen(false) }}
                      className="text-[10px] font-bold uppercase tracking-wider text-purple-900 hover:text-pink-500 transition-colors duration-300 border border-purple-200 rounded-full px-3 py-1 bg-purple-50"
                    >
                      Sign out
                    </button>
                  ) : (
                    <Link
                      href="/login"
                      onClick={() => setOpen(false)}
                      className="text-[10px] font-bold uppercase tracking-wider text-purple-900 hover:text-pink-500 transition-colors duration-300 border border-purple-200 rounded-full px-3 py-1 bg-purple-50"
                    >
                      Sign in
                    </Link>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    aria-label="Close menu"
                    className="min-h-11 min-w-11 flex items-center justify-center
                               text-purple-900 hover:text-pink-500 transition-colors duration-300"
                  >
                    <X className="w-5 h-5" aria-hidden />
                  </button>
                </div>
              </div>

              {/* Navigation list */}
              <nav className="px-6 py-6">
                <ul className="space-y-2 mb-8">
                  {primaryLinks.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        onClick={() => setOpen(false)}
                        className="block py-2.5 font-serif text-2xl font-bold text-purple-950 hover:text-pink-500 transition-colors duration-300"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>

                <p className="eyebrow text-purple-900 mb-2.5">Shop by style</p>
                <ul className="space-y-1 mb-8">
                  {CATEGORIES.map((c) => (
                    <li key={c.slug}>
                      <Link
                        href={`/shop/${c.slug}`}
                        onClick={() => setOpen(false)}
                        className="block py-2 text-sm font-semibold text-purple-900/80 hover:text-pink-500 transition-colors duration-300"
                      >
                        {c.title}
                      </Link>
                    </li>
                  ))}
                </ul>

                <p className="eyebrow text-purple-900 mb-2.5">Account</p>
                <ul className="space-y-1">
                  {authUser ? (
                    <>
                      <li>
                        <Link
                          href="/account"
                          onClick={() => setOpen(false)}
                          className="block py-2 text-sm font-semibold text-purple-900/80 hover:text-pink-500 transition-colors duration-300"
                        >
                          My Account ({authUser.name.split(' ')[0]})
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/account/wishlist"
                          onClick={() => setOpen(false)}
                          className="block py-2 text-sm font-semibold text-purple-900/80 hover:text-pink-500 transition-colors duration-300"
                        >
                          Wishlist
                        </Link>
                      </li>
                    </>
                  ) : (
                    <>
                      <li>
                        <Link
                          href="/login"
                          onClick={() => setOpen(false)}
                          className="block py-2 text-sm font-semibold text-purple-900/80 hover:text-pink-500 transition-colors duration-300"
                        >
                          Sign in
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/account/wishlist"
                          onClick={() => setOpen(false)}
                          className="block py-2 text-sm font-semibold text-purple-900/80 hover:text-pink-500 transition-colors duration-300"
                        >
                          Wishlist
                        </Link>
                      </li>
                    </>
                  )}
                </ul>
              </nav>
            </div>

            {/* Bottom Actions */}
            <div className="px-6 py-6 border-t border-purple-100 bg-purple-50/50 safe-pb">
              <a
                href="https://wa.me/919999999999"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-dark w-full justify-center"
              >
                <MessageCircle className="w-4 h-4" aria-hidden />
                WhatsApp us
              </a>
              <div className="text-center mt-4">
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-bold text-purple-900 hover:text-pink-500 transition-colors duration-300"
                >
                  <Instagram className="w-3.5 h-3.5" aria-hidden />
                  @thesrilathaarts
                </a>
              </div>
            </div>
          </motion.aside>
        </Fragment>
      )}
    </AnimatePresence>
  )
}
