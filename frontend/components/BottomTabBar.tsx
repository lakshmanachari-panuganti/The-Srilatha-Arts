'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Search, Sparkles, Heart, User } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useHaptic } from '@/hooks/useHaptic'

const tabs = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/shop', label: 'Shop', icon: Search },
  { href: '/custom-order', label: 'Custom', icon: Sparkles, raised: true as const },
  { href: '/account/wishlist', label: 'Saved', icon: Heart },
  { href: '/account', label: 'Account', icon: User },
]

export default function BottomTabBar() {
  const pathname = usePathname() || '/'
  const haptic = useHaptic()

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')

  return (
    <nav
      aria-label="Primary"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40"
      style={{
        background: 'rgba(76,29,149,0.92)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(167,139,250,0.30)',
        // Respect device safe areas on every side so notches / rounded corners
        // never clip the rightmost tab. Bottom keeps the existing safe-pb feel.
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
      }}
    >
      <ul className="grid grid-cols-5 h-16 w-full max-w-full">
        {tabs.map(({ href, label, icon: Icon, raised }) => {
          const active = isActive(href)
          return (
            // `min-w-0` is the critical fix — without it a flex child refuses to
            // shrink below its content width, and a slightly-wider label like
            // "Account" pushes the column off-screen on narrow viewports.
            <li key={href} className="flex min-w-0">
              <Link
                href={href}
                onClick={() => haptic(8)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 w-full min-w-0 px-0.5',
                  'font-medium transition-all duration-300',
                  active ? 'text-lavender-pastel' : 'text-lavender-light/85',
                  raised && '-mt-4',
                )}
              >
                <span
                  className={cn(
                    'transition-transform duration-300 shrink-0',
                    raised
                      ? cn(
                          'w-11 h-11 rounded-full flex items-center justify-center',
                          active ? 'scale-105' : '',
                        )
                      : active
                      ? 'scale-110'
                      : 'scale-100',
                  )}
                  style={raised ? {
                    background: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 60%, #E879F9 100%)',
                    color: '#ffffff',
                    boxShadow: '0 4px 16px rgba(124,58,237,0.40)',
                  } : undefined}
                >
                  <Icon className="w-[18px] h-[18px]" aria-hidden />
                </span>
                <span
                  className="block w-full text-center leading-none truncate tracking-tight"
                  style={{ fontSize: '10.5px' }}
                >
                  {label}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
