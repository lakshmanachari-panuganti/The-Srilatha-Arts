'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Instagram, Mail, Menu, MessageCircle, Phone, Search, ShoppingBag, User } from 'lucide-react'
import { useScrollDirection } from '@/hooks/useScrollDirection'
import { useCart, cartCount } from '@/stores/cart'
import { useUI } from '@/stores/ui'
import { useUserAuth } from '@/stores/userAuth'
import MobileDrawer from '@/components/MobileDrawer'
import SearchOverlay from '@/components/SearchOverlay'
import { cn } from '@/lib/cn'
import { CONTACT, waLink } from '@/lib/site-config'

const HIDE_ON_SCROLL_ROUTES = ['/', '/our-story', '/the-craft', '/reviews', '/about']

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/shop', label: 'Collections' },
  { href: '/custom-order', label: 'Custom Orders' },
  { href: '/our-story', label: 'About' },
  { href: '/contact', label: 'Contact' },
] as const

export default function Header() {
  const dir = useScrollDirection(8)
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname() || '/'
  const items = useCart((s) => s.items)
  const count = cartCount(items)

  const setDrawerOpen = useUI((s) => s.setDrawerOpen)
  const setSearchOpen = useUI((s) => s.setSearchOpen)
  const authUser = useUserAuth((s) => s.user)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const canHide = HIDE_ON_SCROLL_ROUTES.includes(pathname)
  const hidden = canHide && dir === 'down' && scrolled

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 z-50 transition-transform duration-500 top-[var(--banner-h)]',
          hidden ? '-translate-y-full' : 'translate-y-0',
        )}
      >
        <div
          className={cn(
            'transition-all duration-500',
            scrolled
              ? 'bg-slate-950/80 backdrop-blur-xl backdrop-saturate-150 shadow-card border-b border-white/[0.06]'
              : 'bg-transparent',
          )}
        >
          <div className="max-w-container mx-auto flex items-center justify-between px-4 lg:px-8 h-16 lg:h-20">
            <Link
              href="/"
              aria-label="Srilatha Art - home"
              className="flex items-center gap-2.5 min-w-0 shrink-0"
            >
              <Image
                src="/Logos/logo.png"
                alt="Srilatha Art"
                width={96}
                height={96}
                priority
                className={cn(
                  'w-[44px] h-[44px] lg:w-[56px] lg:h-[56px] object-contain shrink-0 transition-all duration-500',
                  scrolled ? 'opacity-100' : 'opacity-95',
                )}
              />
              <span className="font-brand tracking-[0.04em] leading-none text-ivory text-[1.65rem] lg:text-[2.25rem]">
                Srilatha Art
              </span>
            </Link>

            <nav className="hidden lg:flex items-center gap-7 text-sm font-medium">
              {NAV_LINKS.map((l) => (
                <Link
                  key={`${l.href}-${l.label}`}
                  href={l.href}
                  className="text-ivory-soft hover:text-blue transition-colors duration-300"
                >
                  {l.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-1 lg:gap-2">
              <a
                href={waLink('Hi Srilatha Art, I would like to know more about your work.')}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Chat on WhatsApp"
                className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-full
                           text-[13px] font-semibold text-white
                           bg-[#25D366] hover:bg-[#1ebe5b]
                           transition-all duration-300
                           shadow-[0_0_18px_rgba(37,211,102,0.45)] hover:shadow-[0_0_28px_rgba(37,211,102,0.65)]"
              >
                <MessageCircle className="w-4 h-4" aria-hidden />
                <span className="hidden lg:inline">WhatsApp</span>
              </a>

              <a
                href={CONTACT.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-full
                           text-[13px] font-semibold text-white
                           bg-[linear-gradient(45deg,#f09433_0%,#e6683c_25%,#dc2743_50%,#cc2366_75%,#bc1888_100%)]
                           hover:brightness-110
                           transition-all duration-300
                           shadow-[0_0_18px_rgba(220,39,67,0.45)] hover:shadow-[0_0_28px_rgba(220,39,67,0.65)]"
              >
                <Instagram className="w-4 h-4" aria-hidden />
                <span className="hidden lg:inline">Instagram</span>
              </a>

              <button
                onClick={() => setSearchOpen(true)}
                aria-label="Search"
                className="min-h-11 min-w-11 flex items-center justify-center
                           text-ivory-soft hover:text-blue transition-colors duration-300"
              >
                <Search className="w-5 h-5" aria-hidden />
              </button>

              <Link
                href={authUser ? '/account' : '/login'}
                aria-label={authUser ? `My account (${authUser.name})` : 'Sign in'}
                className="hidden lg:flex min-h-11 min-w-11 items-center justify-center
                           text-ivory-soft hover:text-blue transition-colors duration-300 relative"
              >
                {authUser ? (
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold
                               bg-brand-gradient-soft text-blue border border-blue/30"
                  >
                    {authUser.name.charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <User className="w-5 h-5" aria-hidden />
                )}
              </Link>

              <Link
                href="/cart"
                aria-label={`Cart, ${count} ${count === 1 ? 'item' : 'items'}`}
                className="relative min-h-11 min-w-11 flex items-center justify-center
                           text-ivory-soft hover:text-blue transition-colors duration-300"
              >
                <ShoppingBag className="w-5 h-5" aria-hidden />
                {count > 0 && (
                  <span
                    className="absolute top-1.5 right-1 min-w-[18px] h-[18px] px-1
                               text-[10px] font-bold leading-[18px] text-center text-white
                               rounded-full bg-gradient-to-br from-blue to-indigo
                               shadow-[0_0_12px_rgba(59,130,246,0.65)]"
                  >
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </Link>

              <button
                onClick={() => setDrawerOpen(true)}
                aria-label="Open menu"
                className="lg:hidden min-h-11 min-w-11 -mr-1 flex items-center justify-center
                           text-ivory-soft hover:text-blue transition-colors duration-300"
              >
                <Menu className="w-5 h-5" aria-hidden />
              </button>
            </div>
          </div>

          <div className="lg:hidden flex flex-col items-end gap-1 px-4 pb-2 -mt-1 text-[13px] text-ivory-soft">
            <a
              href={`mailto:${CONTACT.email}`}
              className="inline-flex items-center gap-2 hover:text-blue transition-colors duration-300"
            >
              <Mail className="w-4 h-4 text-blue" aria-hidden />
              <span>{CONTACT.email}</span>
            </a>
            <a
              href={`tel:${CONTACT.phoneTel}`}
              className="inline-flex items-center gap-2 hover:text-blue transition-colors duration-300"
            >
              <Phone className="w-4 h-4 text-blue" aria-hidden />
              <span>{CONTACT.phoneDisplay}</span>
            </a>
          </div>
        </div>
      </header>

      <div aria-hidden className="h-[calc(var(--banner-h)+7rem)] lg:h-[calc(var(--banner-h)+5rem)]" />

      <MobileDrawer />
      <SearchOverlay />
    </>
  )
}
