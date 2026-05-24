'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { Menu, Search, ShoppingBag, User } from 'lucide-react'
import { useScrollDirection } from '@/hooks/useScrollDirection'
import { useCart, cartCount } from '@/stores/cart'
import { useUI } from '@/stores/ui'
import { useUserAuth } from '@/stores/userAuth'
import MobileDrawer from '@/components/MobileDrawer'
import SearchOverlay from '@/components/SearchOverlay'
import { cn } from '@/lib/cn'

export default function Header() {
  const dir = useScrollDirection(8)
  const [scrolled, setScrolled] = useState(false)
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

  const hidden = dir === 'down' && scrolled

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 z-50 transition-all duration-500 top-4 px-4 max-w-6xl mx-auto',
          hidden ? '-translate-y-28 opacity-0' : 'translate-y-0 opacity-100',
        )}
      >
        <div
          className={cn(
            'flex items-center justify-between px-6 lg:px-10 h-16 lg:h-20 transition-all duration-500 rounded-full shadow-lg border',
            scrolled
              ? 'bg-white/80 backdrop-blur-md border-purple-200/50 shadow-purple-100/50'
              : 'bg-white/40 backdrop-blur-sm border-purple-100/20 shadow-transparent',
          )}
        >
          {/* Left: Mobile hamburger menu trigger & Desktop nav links */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className="lg:hidden min-h-11 min-w-11 -ml-2 flex items-center justify-center
                         text-purple-950 hover:text-pink-500 active:scale-95 transition-all duration-300"
            >
              <Menu className="w-6 h-6" aria-hidden />
            </button>
            <nav className="hidden lg:flex items-center gap-8 text-sm font-bold tracking-wider uppercase">
              <Link href="/shop" className="text-purple-900 hover:text-pink-500 transition-colors duration-300">
                Shop
              </Link>
              <Link href="/custom-order" className="text-purple-900 hover:text-pink-500 transition-colors duration-300">
                Custom orders
              </Link>
              <Link href="/our-story" className="text-purple-900 hover:text-pink-500 transition-colors duration-300">
                About us
              </Link>
              <Link href="/contact" className="text-purple-900 hover:text-pink-500 transition-colors duration-300">
                Contact
              </Link>
            </nav>
          </div>

          {/* Center: Centered Logo Monogram */}
          <Link
            href="/"
            aria-label="Srilatha Art - home"
            className="absolute left-1/2 -translate-x-1/2 flex items-center group"
          >
            <div className="relative w-12 h-12 lg:w-16 lg:h-16 flex items-center justify-center rounded-full bg-purple-950 border-2 border-purple-300/30 overflow-hidden shadow-md group-hover:scale-105 group-hover:border-purple-400 transition-all duration-300">
              <Image
                src="/images/logo.png"
                alt="Srilatha Art"
                width={56}
                height={56}
                priority
                className="w-10 h-10 lg:w-14 lg:h-14 object-contain"
              />
            </div>
          </Link>

          {/* Right: Search trigger, Account trigger, and Cart triggers */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              className="min-h-11 min-w-11 flex items-center justify-center
                         text-purple-950 hover:text-pink-500 active:scale-95 transition-all duration-300"
            >
              <Search className="w-5 h-5" aria-hidden />
            </button>
            {/* Account / Login icon — desktop only */}
            <Link
              href={authUser ? '/account' : '/login'}
              aria-label={authUser ? `My account (${authUser.name})` : 'Sign in'}
              className="hidden lg:flex min-h-11 min-w-11 items-center justify-center
                         text-purple-950 hover:text-pink-500 active:scale-95 transition-all duration-300 relative"
            >
              {authUser ? (
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black
                             bg-gradient-to-tr from-purple-500 to-pink-400 text-white shadow-sm border border-white"
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
              className="relative min-h-11 min-w-11 -mr-2 flex items-center justify-center
                         text-purple-950 hover:text-pink-500 active:scale-95 transition-all duration-300"
            >
              <ShoppingBag className="w-5 h-5" aria-hidden />
              {count > 0 && (
                <span
                  className="absolute top-2 right-1.5 min-w-[18px] h-[18px] px-1.5
                             text-[10px] font-black leading-[18px] text-center text-white shadow-sm"
                  style={{
                    borderRadius: '24px',
                    background: 'linear-gradient(135deg, #EC4899, #8B5CF6)',
                  }}
                >
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* Spacer so content doesn't slide under the floating header */}
      <div aria-hidden className="h-24 lg:h-28" />

      <MobileDrawer />
      <SearchOverlay />
    </>
  )
}
