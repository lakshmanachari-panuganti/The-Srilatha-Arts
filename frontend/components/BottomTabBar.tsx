'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Search, Sparkles, Heart, User } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useHaptic } from '@/hooks/useHaptic'

// Five equal-weight tabs. The previous design had "Custom" as a raised,
// gradient-filled floating button - visually it screamed louder than the
// brand itself on every screen of the site. Demoted to a regular tab so
// the nav reads as a quiet utility surface, not a sales pitch.
const tabs = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/shop', label: 'Shop', icon: Search },
  { href: '/custom-order', label: 'Custom', icon: Sparkles },
  { href: '/account/wishlist', label: 'Wishlist', icon: Heart },
  { href: '/account', label: 'Account', icon: User },
]

export default function BottomTabBar() {
  const pathname = usePathname() || '/'
  const haptic = useHaptic()

  // Pick the most-specific matching tab so nested routes like /account/wishlist
  // don't also light up the broader /account tab.
  const activeHref = tabs
    .map((t) => t.href)
    .filter((href) =>
      href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/'),
    )
    .sort((a, b) => b.length - a.length)[0]

  const isActive = (href: string) => href === activeHref

  return (
    <nav
      aria-label="Primary"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40"
      style={{
        background: 'color-mix(in srgb, var(--brand-strong) 96%, transparent)',
        borderTop: '1px solid var(--border)',
        // Respect device safe areas on every side so notches / rounded corners
        // never clip the rightmost tab. Bottom keeps the existing safe-pb feel.
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
      }}
    >
      <ul
        className="h-16"
        style={{
          // Explicit grid with `minmax(0,1fr)` + zero gap - guarantees five equal
          // columns that each refuse to grow beyond their share, regardless of
          // child content. Inline so it can never be overridden by a stale
          // utility class shipped in an older CSS bundle.
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          gap: 0,
          width: '100%',
        }}
      >
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = isActive(href)
          return (
            <li key={href} className="flex" style={{ minWidth: 0, overflow: 'hidden' }}>
              <Link
                href={href}
                onClick={() => haptic(8)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-1',
                  'font-medium transition-all duration-300',
                  active ? '' : 'text-plum-warm',
                )}
                style={{
                  width: '100%',
                  minWidth: 0,
                  overflow: 'hidden',
                  color: active ? '#E8C25A' : undefined,
                }}
              >
                <span
                  className={cn(
                    'transition-transform duration-300 shrink-0',
                    active ? 'scale-110' : 'scale-100',
                  )}
                >
                  <Icon className="w-[18px] h-[18px]" aria-hidden />
                </span>
                <span
                  style={{
                    display: 'block',
                    width: '100%',
                    maxWidth: '100%',
                    fontSize: '10px',
                    lineHeight: 1,
                    letterSpacing: '-0.01em',
                    textAlign: 'center',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </span>
                {/* Active dot indicator — color-independent signal */}
                {active && (
                  <span
                    aria-hidden
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full"
                    style={{ background: 'var(--accent)' }}
                  />
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
