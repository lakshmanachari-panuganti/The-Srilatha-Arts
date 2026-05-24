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
      aria-label="Primary navigation"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 safe-pb shadow-2xl border-t border-purple-200/50"
      style={{
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <ul className="grid grid-cols-5 h-16 items-center">
        {tabs.map(({ href, label, icon: Icon, raised }) => {
          const active = isActive(href)
          return (
            <li key={href} className="flex h-full">
              <Link
                href={href}
                onClick={() => haptic(8)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 w-full h-full relative',
                  'text-[10px] font-bold tracking-wider uppercase transition-all duration-300',
                  active ? 'text-pink-500 font-black' : 'text-purple-900',
                  raised && '-mt-6',
                )}
              >
                <span
                  className={cn(
                    'transition-all duration-300 flex items-center justify-center',
                    raised
                      ? cn(
                          'w-12 h-12 rounded-full flex items-center justify-center shadow-lg',
                          active ? 'scale-110 rotate-12' : '',
                        )
                      : active
                      ? 'scale-110 -translate-y-0.5'
                      : 'scale-100',
                  )}
                  style={raised ? {
                    background: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
                    color: '#ffffff',
                    boxShadow: '0 4px 16px rgba(139, 92, 246, 0.4)',
                  } : undefined}
                >
                  <Icon className={raised ? 'w-5 h-5' : 'w-[18px] h-[18px]'} aria-hidden />
                </span>
                <span className={cn(raised ? 'mt-1' : '')}>{label}</span>
                {active && !raised && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full bg-pink-500" />
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
