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
            'mx-auto flex items-center justify-between px-4 lg:px-8 h-14 lg:h-16',
            'border-b transition-all duration-300',
            scrolled
              ? 'bg-primary-dark/85 backdrop-blur-xl border-gold/15'
              : 'bg-primary-dark/30 backdrop-blur-md border-transparent',
          )}
        >
          {/* Left: hamburger (mobile) + nav (desktop) */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className="lg:hidden min-h-11 min-w-11 -ml-2 flex items-center justify-center
                         text-cream hover:text-gold transition-colors"
            >
              <Menu className="w-5 h-5" aria-hidden />
            </button>
            <nav className="hidden lg:flex items-center gap-7 text-sm">
              <Link href="/shop" className="text-cream/85 hover:text-gold transition-colors">
                Shop
              </Link>
              <Link href="/new-arrivals" className="text-cream/85 hover:text-gold transition-colors">
                New
              </Link>
              <Link href="/best-sellers" className="text-cream/85 hover:text-gold transition-colors">
                Best Sellers
              </Link>
              <Link href="/custom-order" className="text-cream/85 hover:text-gold transition-colors">
                Custom
              </Link>
              <Link href="/our-story" className="text-cream/85 hover:text-gold transition-colors">
                Our Story
              </Link>
            </nav>
          </div>

          {/* Center: logo */}
          <Link
            href="/"
            aria-label="The Srilatha Arts — home"
            className="absolute left-1/2 -translate-x-1/2 flex items-center"
          >
            <Image
              src="/images/logo-horizontal.png"
              alt="The Srilatha Arts"
              width={140}
              height={36}
              priority
              className="h-7 lg:h-8 w-auto"
            />
          </Link>

          {/* Right: search + cart */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              className="min-h-11 min-w-11 flex items-center justify-center
                         text-cream hover:text-gold transition-colors"
            >
              <Search className="w-5 h-5" aria-hidden />
            </button>
            <Link
              href="/cart"
              aria-label={`Cart, ${count} ${count === 1 ? 'item' : 'items'}`}
              className="relative min-h-11 min-w-11 -mr-2 flex items-center justify-center
                         text-cream hover:text-gold transition-colors"
            >
              <ShoppingBag className="w-5 h-5" aria-hidden />
              {count > 0 && (
                <span
                  className="absolute top-2 right-1.5 min-w-[18px] h-[18px] px-1
                             rounded-full bg-gold text-primary-dark text-[10px]
                             font-bold leading-[18px] text-center"
                >
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* spacer so content doesn't slide under the fixed header */}
      <div aria-hidden className="h-[calc(var(--banner-h)+3.5rem)] lg:h-[calc(var(--banner-h)+4rem)]" />

      <MobileDrawer />
      <SearchOverlay />
    </>
  )
}
