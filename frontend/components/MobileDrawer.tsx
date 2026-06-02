'use client'
import { Fragment, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import {
  X, MessageCircle, Instagram, Sparkles, ShoppingBag, Palette,
  BookOpen, Mail, ChevronDown, User, LogOut,
} from 'lucide-react'
import { useUI } from '@/stores/ui'
import { useUserAuth } from '@/stores/userAuth'
import { CATEGORIES } from '@/data/categories'
import { SOCIAL, INSTAGRAM_HANDLE, whatsappLink } from '@/lib/site-config'

// Primary navigation grouped by intent. The accordion for Shop keeps the menu
// short by default — opening it surfaces the five categories without making
// every visit a long scroll past links the user did not ask for.
type LeafItem = { kind: 'leaf'; href: string; label: string; icon: React.ComponentType<{ className?: string }> }
type AccordionItem = {
  kind: 'accordion'
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  items: { href: string; label: string }[]
}
type NavItem = LeafItem | AccordionItem

const NAV_ITEMS: NavItem[] = [
  { kind: 'leaf', href: '/custom-order', label: 'Custom Artwork', icon: Sparkles },
  {
    kind: 'accordion',
    id: 'shop',
    label: 'Shop',
    icon: ShoppingBag,
    items: CATEGORIES.map((c) => ({ href: `/shop/${c.slug}`, label: c.title })),
  },
  { kind: 'leaf', href: '/shop',       label: 'Explore Styles', icon: Palette },
  { kind: 'leaf', href: '/our-story',  label: 'About',          icon: BookOpen },
  { kind: 'leaf', href: '/contact',    label: 'Contact',        icon: Mail },
]

export default function MobileDrawer() {
  const open = useUI((s) => s.drawerOpen)
  const setOpen = useUI((s) => s.setDrawerOpen)
  const authUser = useUserAuth((s) => s.user)
  const logout = useUserAuth((s) => s.logout)
  const [openSection, setOpenSection] = useState<string | null>(null)

  const close = () => setOpen(false)

  return (
    <AnimatePresence>
      {open && (
        <Fragment>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            onClick={close}
            className="fixed inset-0 z-[70] bg-plum/70 backdrop-blur-sm"
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
            className="fixed top-0 bottom-0 left-0 z-[71] w-[88vw] max-w-sm flex flex-col safe-pt"
            style={{
              background: 'var(--brand)',
              borderRight: '1px solid color-mix(in srgb, #ffffff 12%, transparent)',
              boxShadow: '24px 0 60px -20px rgba(0,0,0,0.55)',
            }}
          >
            {/* ── Header: brand mark + sign-in pill + close ─────────────────── */}
            <header className="flex-none px-5 pt-4 pb-3 flex items-start justify-between gap-3">
              <Link
                href="/"
                onClick={close}
                aria-label="Srilatha Art - home"
                className="flex items-center gap-2 min-w-0"
              >
                <Image
                  src="/Logos/logo.svg"
                  alt=""
                  width={56}
                  height={56}
                  className="w-12 h-12 object-contain shrink-0
                             drop-shadow-[0_0_14px_rgba(200,150,47,0.35)]"
                />
                <span className="font-brand text-[2.25rem] leading-none text-plum tracking-[0.04em] truncate">
                  Srilatha Art
                </span>
              </Link>
              <div className="flex items-center gap-2 shrink-0">
                {!authUser && (
                  <Link
                    href="/login"
                    onClick={close}
                    className="text-[11px] uppercase tracking-[0.15em] text-plum hover:text-lavender-pastel
                               transition-colors duration-300 border border-white/20 rounded-full
                               px-3 h-8 inline-flex items-center"
                  >
                    Sign in
                  </Link>
                )}
                <button
                  onClick={close}
                  aria-label="Close menu"
                  className="min-h-11 min-w-11 flex items-center justify-center
                             text-plum hover:text-lavender-pastel transition-colors duration-300"
                >
                  <X className="w-5 h-5" aria-hidden />
                </button>
              </div>
            </header>

            {/* Tagline — sets the premium tone without consuming a row of nav */}
            <p className="flex-none px-5 pb-4 font-serif italic text-base text-plum-warm/95
                          border-b border-white/10">
              Handcrafted Art For Modern Homes
            </p>

            {/* ── Scrollable nav (accordion + primary leaves) ───────────────── */}
            <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Primary navigation">
              <ul className="space-y-1">
                {NAV_ITEMS.map((item) =>
                  item.kind === 'leaf' ? (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={close}
                        className="flex items-center gap-3.5 min-h-12 px-3 rounded-xl
                                   font-serif text-xl text-plum
                                   hover:bg-white/[0.06] hover:text-lavender-pastel
                                   transition-colors duration-300"
                      >
                        <span className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/10
                                         flex items-center justify-center shrink-0">
                          <item.icon className="w-4 h-4 text-lavender-pastel" aria-hidden />
                        </span>
                        {item.label}
                      </Link>
                    </li>
                  ) : (
                    <AccordionRow
                      key={item.id}
                      item={item}
                      isOpen={openSection === item.id}
                      onToggle={() =>
                        setOpenSection((cur) => (cur === item.id ? null : item.id))
                      }
                      onLeafClick={close}
                    />
                  ),
                )}
              </ul>

              {/* Account row — links to existing comprehensive dashboard at /account */}
              <p className="eyebrow text-lavender-pastel/80 mt-7 mb-2 px-3">Account</p>
              <ul className="space-y-1">
                <li>
                  <Link
                    href={authUser ? '/account' : '/login?next=/account'}
                    onClick={close}
                    className="flex items-center gap-3.5 min-h-12 px-3 rounded-xl
                               text-plum hover:bg-white/[0.06] hover:text-lavender-pastel
                               transition-colors duration-300"
                  >
                    <span className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/10
                                     flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-lavender-pastel" aria-hidden />
                    </span>
                    <span className="flex-1">
                      {authUser ? `Hello, ${authUser.name.split(' ')[0]}` : 'Sign in'}
                    </span>
                    {authUser && (
                      <span className="text-[11px] uppercase tracking-[0.15em] text-plum-warm/80">
                        Dashboard
                      </span>
                    )}
                  </Link>
                </li>
                {authUser && (
                  <li>
                    <button
                      onClick={() => { logout(); close() }}
                      className="w-full flex items-center gap-3.5 min-h-12 px-3 rounded-xl text-left
                                 text-plum-warm hover:bg-white/[0.06] hover:text-lavender-pastel
                                 transition-colors duration-300"
                    >
                      <span className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/10
                                       flex items-center justify-center shrink-0">
                        <LogOut className="w-4 h-4 text-lavender-pastel" aria-hidden />
                      </span>
                      Sign out
                    </button>
                  </li>
                )}
              </ul>
            </nav>

            {/* ── Sticky footer CTA — WhatsApp + Instagram, always visible ─── */}
            <div
              className="flex-none px-5 pt-4 pb-5 safe-pb"
              style={{
                borderTop: '1px solid color-mix(in srgb, #ffffff 10%, transparent)',
                background: 'color-mix(in srgb, var(--brand-strong) 60%, transparent)',
              }}
            >
              <a
                href={whatsappLink("Hi Srilatha Art, I'd like to know more about your work.")}
                target="_blank"
                rel="noopener noreferrer"
                onClick={close}
                className="w-full inline-flex items-center justify-center gap-2.5 h-12 rounded-full
                           text-white font-medium text-sm tracking-wide
                           transition-transform duration-200 active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, var(--wa-1) 0%, var(--wa-2) 100%)',
                  boxShadow:
                    '0 10px 24px -10px rgba(18,140,126,0.55), 0 0 0 1px rgba(255,255,255,0.08) inset',
                }}
              >
                <MessageCircle className="w-4 h-4" aria-hidden />
                WhatsApp us
              </a>
              <a
                href={SOCIAL.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 text-sm text-plum-warm
                           hover:text-lavender-pastel transition-colors duration-300"
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

// ─── Accordion row ─────────────────────────────────────────────────
// One open section at a time (parent state). Smooth height collapse via
// framer-motion's auto-height pattern. ARIA: button is the trigger, the
// expanded panel is the controlled region.

function AccordionRow({
  item,
  isOpen,
  onToggle,
  onLeafClick,
}: {
  item: AccordionItem
  isOpen: boolean
  onToggle: () => void
  onLeafClick: () => void
}) {
  const panelId = `drawer-acc-${item.id}`
  return (
    <li>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={onToggle}
        className="w-full flex items-center gap-3.5 min-h-12 px-3 rounded-xl text-left
                   font-serif text-xl text-plum
                   hover:bg-white/[0.06] hover:text-lavender-pastel
                   transition-colors duration-300"
      >
        <span className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/10
                         flex items-center justify-center shrink-0">
          <item.icon className="w-4 h-4 text-lavender-pastel" aria-hidden />
        </span>
        <span className="flex-1">{item.label}</span>
        <ChevronDown
          className={`w-4 h-4 text-plum-warm transition-transform duration-300 ${
            isOpen ? 'rotate-180' : 'rotate-0'
          }`}
          aria-hidden
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="overflow-hidden"
          >
            <ul className="pl-14 pr-3 py-1 space-y-0.5">
              {item.items.map((c) => (
                <li key={c.href}>
                  <Link
                    href={c.href}
                    onClick={onLeafClick}
                    className="block min-h-11 leading-[44px] text-[15px] text-plum-warm
                               hover:text-lavender-pastel transition-colors duration-300"
                  >
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}
