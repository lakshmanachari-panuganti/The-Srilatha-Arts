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
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 safe-pb"
      style={{
        background: 'rgba(43,30,52,0.92)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <ul className="grid grid-cols-5 h-16">
        {tabs.map(({ href, label, icon: Icon, raised }) => {
          const active = isActive(href)
          return (
            <li key={href} className="flex">
              <Link
                href={href}
                onClick={() => haptic(8)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 w-full',
                  'text-[10px] font-medium transition-all duration-300',
                  active ? 'text-lavender-pastel' : 'text-ivory-mute',
                  raised && '-mt-5',
                )}
              >
                <span
                  className={cn(
                    'transition-transform duration-300',
                    raised
                      ? cn(
                          'w-12 h-12 rounded-full flex items-center justify-center shadow-card',
                          active ? 'scale-110' : '',
                        )
                      : active
                      ? 'scale-110'
                      : 'scale-100',
                  )}
                  style={raised ? {
                    background: 'linear-gradient(135deg, #C8B6FF, #8A74C9)',
                    color: '#2B1E34',
                  } : undefined}
                >
                  <Icon className={raised ? 'w-5 h-5' : 'w-[18px] h-[18px]'} aria-hidden />
                </span>
                <span>{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
