'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Mail, Menu, Phone, Search, ShoppingBag, User } from 'lucide-react'
import { useScrollDirection } from '@/hooks/useScrollDirection'
import { useCart, cartCount } from '@/stores/cart'
import { useUI } from '@/stores/ui'
import { useUserAuth } from '@/stores/userAuth'
import MobileDrawer from '@/components/MobileDrawer'
import SearchOverlay from '@/components/SearchOverlay'
import { cn } from '@/lib/cn'
import { PHONE_DISPLAY, PHONE_TEL, STUDIO_EMAIL } from '@/lib/site-config'

// Routes where the header is allowed to hide-on-scroll-down. Home + brand
// pages tolerate it. PDP, cart, checkout, account need the cart icon + search
// always reachable — hiding the header on those pages strands the user away
// from key actions (audit §4).
const HIDE_ON_SCROLL_ROUTES = ['/', '/our-story', '/the-craft', '/reviews', '/about']

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
          'fixed inset-x-0 z-50 transition-transform duration-500',
          'top-[var(--banner-h)]',
          hidden ? '-translate-y-full' : 'translate-y-0',
        )}
      >
        <div
          className={cn(
            'mx-auto flex items-center justify-between px-4 lg:px-8 h-20 lg:h-28',
            'transition-all duration-500',
            scrolled
              ? 'glass-strong'
              : 'bg-plum/40 backdrop-blur-sm',
          )}
          style={{ borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent' }}
        >
          {/* Left: logo + brand name (all viewports) — branding-first focal point */}
          <div className="flex items-center min-w-0">
            <Link
              href="/"
              aria-label="Srilatha Art - home"
              className="flex items-center gap-2.5 min-w-0"
            >
              <Image
                src="/Logos/logo.svg"
                alt="Srilatha Art"
                width={112}
                height={112}
                priority
                className={cn(
                  'w-[68px] h-[68px] lg:w-28 lg:h-28 object-contain transition-all duration-500 shrink-0',
                  'drop-shadow-[0_2px_6px_rgba(34,27,18,0.10)]',
                  scrolled ? 'opacity-100' : 'opacity-95',
                )}
              />
              <span className="font-brand tracking-[0.06em] text-ivory text-[2.25rem] leading-none lg:text-5xl lg:leading-normal">
                Srilatha Art
              </span>
            </Link>
          </div>

          {/* Right: on mobile, icons row stacked above contact links; on desktop, single row */}
          <div className="flex flex-col items-end gap-1 lg:flex-row lg:items-center lg:gap-1">
            <div className="flex items-center gap-1">
            <nav className="hidden lg:flex items-center gap-8 text-sm mr-2 font-medium tracking-[0.06em] uppercase">
              <Link href="/shop" className="text-ivory-soft hover:text-lavender-pastel transition-colors duration-500">
                Collections
              </Link>
              <Link href="/custom-order" className="text-ivory-soft hover:text-lavender-pastel transition-colors duration-500">
                Custom orders
              </Link>
              <Link href="/our-story" className="text-ivory-soft hover:text-lavender-pastel transition-colors duration-500">
                About
              </Link>
              <Link href="/contact" className="text-ivory-soft hover:text-lavender-pastel transition-colors duration-500">
                Contact
              </Link>
            </nav>
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              className="min-h-11 min-w-11 flex items-center justify-center
                         text-ivory hover:text-lavender-pastel transition-colors duration-500"
            >
              <Search className="w-5 h-5" aria-hidden />
            </button>
            {/* Account / Login icon — desktop only */}
            <Link
              href={authUser ? '/account' : '/login'}
              aria-label={authUser ? `My account (${authUser.name})` : 'Sign in'}
              className="hidden lg:flex min-h-11 min-w-11 items-center justify-center
                         text-ivory hover:text-lavender-pastel transition-colors duration-500 relative"
            >
              {authUser ? (
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold
                             bg-lavender-pastel/30 text-ivory border border-lavender-pastel/40"
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
                         text-ivory hover:text-lavender-pastel transition-colors duration-500"
            >
              <ShoppingBag className="w-5 h-5" aria-hidden />
              {count > 0 && (
                <span
                  className="absolute top-2 right-1.5 min-w-[18px] h-[18px] px-1
                             text-[10px] font-bold leading-[18px] text-center text-plum"
                  style={{
                    borderRadius: '24px',
                    background: 'linear-gradient(135deg, var(--brand), var(--brand-strong))',
                  }}
                >
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </Link>
            {/* Hamburger — mobile only, rightmost */}
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className="lg:hidden min-h-11 min-w-11 -mr-2 flex items-center justify-center
                         text-ivory hover:text-lavender-pastel transition-colors duration-500"
            >
              <Menu className="w-5 h-5" aria-hidden />
            </button>
            </div>

            {/* Contact links — mobile only, below the icons row */}
            <div className="flex flex-col items-end gap-0.5 text-[11px] leading-tight lg:hidden">
              <a
                href={`mailto:${STUDIO_EMAIL}`}
                aria-label={`Email ${STUDIO_EMAIL}`}
                className="flex items-center gap-1.5 text-ivory-soft hover:text-lavender-pastel transition-colors duration-300"
              >
                <Mail className="w-3 h-3 text-lavender" aria-hidden />
                <span>{STUDIO_EMAIL}</span>
              </a>
              <a
                href={`tel:${PHONE_TEL}`}
                aria-label={`Call ${PHONE_DISPLAY}`}
                className="flex items-center gap-1.5 text-ivory-soft hover:text-lavender-pastel transition-colors duration-300"
              >
                <Phone className="w-3 h-3 text-lavender" aria-hidden />
                <span>{PHONE_DISPLAY}</span>
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Spacer so content doesn't slide under the fixed header */}
      <div aria-hidden className="h-[calc(var(--banner-h)+5rem)] lg:h-[calc(var(--banner-h)+7.5rem)]" />

      <MobileDrawer />
      <SearchOverlay />
    </>
  )
}
