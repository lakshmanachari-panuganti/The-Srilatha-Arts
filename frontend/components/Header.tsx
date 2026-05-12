'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { Menu, Search, ShoppingBag } from 'lucide-react'
import { useScrollDirection } from '@/hooks/useScrollDirection'
import { useCart, cartCount } from '@/stores/cart'
import { useUI } from '@/stores/ui'
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
          'fixed inset-x-0 z-50 transition-transform duration-300',
          'top-[var(--banner-h)]',
          hidden ? '-translate-y-full' : 'translate-y-0',
        )}
      >
        <div
          className={cn(
            'mx-auto flex items-center justify-between px-4 lg:px-8 h-16 lg:h-20',
            'transition-all duration-300 border-b',
            scrolled
              ? 'bg-cream/90 backdrop-blur-xl border-ink/8'
              : 'bg-cream/60 backdrop-blur-sm border-transparent',
          )}
        >
          {/* Left: hamburger (mobile) + minimal nav (desktop) */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className="lg:hidden min-h-11 min-w-11 -ml-2 flex items-center justify-center
                         text-ink hover:text-terracotta transition-colors"
            >
              <Menu className="w-5 h-5" aria-hidden />
            </button>
            <nav className="hidden lg:flex items-center gap-8 text-sm">
              <Link href="/shop" className="text-ink/85 hover:text-terracotta transition-colors">
                Shop
              </Link>
              <Link href="/custom-order" className="text-ink/85 hover:text-terracotta transition-colors">
                Custom
              </Link>
              <Link href="/our-story" className="text-ink/85 hover:text-terracotta transition-colors">
                Our Story
              </Link>
              <Link href="/contact" className="text-ink/85 hover:text-terracotta transition-colors">
                Contact
              </Link>
            </nav>
          </div>

          {/* Center: large round logo monogram */}
          <Link
            href="/"
            aria-label="The Srilatha Arts — home"
            className="absolute left-1/2 -translate-x-1/2 flex items-center"
          >
            <Image
              src="/images/logo.png"
              alt="The Srilatha Arts"
              width={56}
              height={56}
              priority
              className={cn(
                'w-12 h-12 lg:w-14 lg:h-14 object-contain transition-all duration-300',
                scrolled ? 'opacity-100' : 'opacity-95',
              )}
            />
          </Link>

          {/* Right: search + cart */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              className="min-h-11 min-w-11 flex items-center justify-center
                         text-ink hover:text-terracotta transition-colors"
            >
              <Search className="w-5 h-5" aria-hidden />
            </button>
            <Link
              href="/cart"
              aria-label={`Cart, ${count} ${count === 1 ? 'item' : 'items'}`}
              className="relative min-h-11 min-w-11 -mr-2 flex items-center justify-center
                         text-ink hover:text-terracotta transition-colors"
            >
              <ShoppingBag className="w-5 h-5" aria-hidden />
              {count > 0 && (
                <span
                  className="absolute top-2 right-1.5 min-w-[18px] h-[18px] px-1
                             rounded-full bg-terracotta text-cream text-[10px]
                             font-bold leading-[18px] text-center"
                >
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* Spacer so content doesn't slide under the fixed header */}
      <div aria-hidden className="h-[calc(var(--banner-h)+4rem)] lg:h-[calc(var(--banner-h)+5rem)]" />

      <MobileDrawer />
      <SearchOverlay />
    </>
  )
}
