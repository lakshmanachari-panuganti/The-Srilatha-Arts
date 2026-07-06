'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Package, ShoppingBag, LayoutDashboard, Tag, MessageSquare,
  Ticket, Image as ImageIcon, Settings, LogOut, Layers, FolderOpen,
  Users, BarChart3, Archive, MessageCircle, Clock,
} from 'lucide-react'
import { useAdminAuth } from '@/stores/adminAuth'
import { useIdleTimeout } from '@/hooks/useIdleTimeout'

// Auto-signout policy for the admin surface:
//   - 10 minutes of inactivity → auto sign out
//   - Warning modal appears 60 seconds before, so a burst of activity
//     can extend the session mid-form without silent kick-outs
const IDLE_MS = 10 * 60 * 1000
const WARN_BEFORE_MS = 60 * 1000

const navItems = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Orders', href: '/admin/orders', icon: ShoppingBag },
  { name: 'Products', href: '/admin/products', icon: Package },
  { name: 'Inventory', href: '/admin/inventory', icon: Archive },
  { name: 'Categories', href: '/admin/categories', icon: Layers },
  { name: 'Collections', href: '/admin/collections', icon: FolderOpen },
  { name: 'Custom Orders', href: '/admin/custom-orders', icon: ImageIcon },
  { name: 'Reviews', href: '/admin/reviews', icon: MessageSquare },
  { name: 'WhatsApp', href: '/admin/whatsapp', icon: MessageCircle },
  { name: 'Coupons', href: '/admin/coupons', icon: Ticket },
  { name: 'Customers', href: '/admin/customers', icon: Users },
  { name: 'Announcements', href: '/admin/announcements', icon: Tag },
  { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/admin/settings', icon: Settings },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAdminAuth()
  const [hydrated, setHydrated] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isLoginRoute = pathname === '/admin/login' || pathname === '/admin/login/'

  // Wait for Zustand hydration from localStorage
  useEffect(() => {
    setHydrated(true)
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  // Guard: redirect to login if not authenticated (after hydration).
  // Calling router.replace during render triggers React warnings and races
  // with concurrent rendering; route changes must happen in an effect.
  useEffect(() => {
    if (!hydrated) return
    if (isLoginRoute) return
    if (!user) router.replace('/admin/login')
  }, [hydrated, isLoginRoute, user, router])

  const handleLogout = useCallback(() => {
    logout()
    router.replace('/admin/login')
  }, [logout, router])

  // Idle auto-signout: 10-minute inactivity timer with a 60s warning modal.
  // Hooks must run unconditionally, so we always call useIdleTimeout and
  // gate its behavior on `enabled`. The timer is disabled on the login
  // route and until Zustand has hydrated so we don't count time while
  // there is no session to protect.
  const idleEnabled = hydrated && !!user && !isLoginRoute
  const { warning, secondsLeft, reset } = useIdleTimeout({
    idleMs: IDLE_MS,
    warnBeforeMs: WARN_BEFORE_MS,
    enabled: idleEnabled,
    onTimeout: handleLogout,
  })

  // Do not show the sidebar on the login page
  if (isLoginRoute) {
    return <>{children}</>
  }

  // Show loading state while hydrating, or while we're about to redirect.
  if (!hydrated || !user) {
    return (
      <div className="min-h-screen bg-plum flex items-center justify-center">
        <div className="animate-pulse text-ink-mute text-sm">
          {!hydrated ? 'Loading...' : 'Redirecting to login...'}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-plum flex flex-col lg:flex-row">
      {/* Mobile Header */}
      <header className="lg:hidden bg-plum-light border-b border-ink/5 p-4 flex items-center justify-between sticky top-0 z-30">
        <Link href="/" className="font-brand text-3xl text-ink tracking-[0.04em]">
          Srilatha<em className="not-italic gold-text ml-1.5">Art</em>
        </Link>
        <button
          className="p-2 -mr-2 text-ink-soft"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 top-[57px] z-40 bg-ink/30 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}>
          <nav
            className="bg-plum-light w-72 h-full overflow-y-auto border-r border-ink/5 p-4 space-y-1"
            onClick={(e) => e.stopPropagation()}
          >
            {user && (
              <div className="px-3 py-3 mb-2 border-b border-ink/5">
                <p className="text-sm font-medium text-ink">{user.name}</p>
                <p className="text-xs text-ink-mute capitalize">{user.role}</p>
              </div>
            )}
            {navItems.map((item) => {
              const isActive = item.href === '/admin'
                ? pathname === '/admin' || pathname === '/admin/'
                : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue/20 text-white ring-1 ring-inset ring-blue/40 shadow-[inset_3px_0_0_0_rgb(var(--accent-blue-rgb))]'
                      : 'text-ink-soft hover:bg-white/5 hover:text-ink'
                  }`}
                >
                  <item.icon className={`w-4 h-4 ${isActive ? 'text-blue' : ''}`} />
                  {item.name}
                </Link>
              )
            })}
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-rose-300 rounded-lg hover:bg-rose-500/10 hover:text-rose-200 w-full transition-colors mt-4"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </nav>
        </div>
      )}

      {/* Sidebar (Desktop) */}
      <aside className="hidden lg:flex w-64 bg-plum-light border-r border-ink/5 flex-col fixed inset-y-0 left-0 z-20">
        <div className="p-6 border-b border-ink/5">
          <Link href="/" className="font-brand text-4xl text-ink tracking-[0.04em]">
            Srilatha<em className="not-italic gold-text ml-1.5">Art</em>
          </Link>
          <p className="text-xs text-ink-mute mt-1 uppercase tracking-wider font-semibold">Admin Workspace</p>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = item.href === '/admin'
              ? pathname === '/admin' || pathname === '/admin/'
              : pathname.startsWith(item.href)
            return (
              <Link
                key={item.name}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue/20 text-white ring-1 ring-inset ring-blue/40 shadow-[inset_3px_0_0_0_rgb(var(--accent-blue-rgb))]'
                    : 'text-ink-soft hover:bg-white/5 hover:text-ink'
                }`}
              >
                <item.icon className={`w-4 h-4 ${isActive ? 'text-blue' : ''}`} />
                {item.name}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-ink/5">
          {user && (
            <div className="px-3 py-2 mb-2">
              <p className="text-sm font-medium text-ink truncate">{user.name}</p>
              <p className="text-xs text-ink-mute capitalize">{user.role}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-rose-300 rounded-lg hover:bg-rose-500/10 hover:text-rose-200 w-full transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 p-4 lg:p-8 w-full max-w-[100vw]">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>

      {/* Idle-timeout warning. Modal blocks page interaction so the admin
          has to make an explicit choice: keep working (reset) or sign out.
          We intentionally don't auto-dismiss on outside click - one
          missed click could hand a session to whoever walks by. */}
      {warning && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="idle-warn-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 backdrop-blur-sm px-4"
        >
          <div className="w-full max-w-sm bg-plum-light border border-ink/10 rounded-2xl shadow-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/15 ring-1 ring-inset ring-amber-500/30 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-amber-300" aria-hidden />
              </div>
              <h2 id="idle-warn-title" className="font-serif text-lg text-ink">
                Still there?
              </h2>
            </div>
            <p className="text-sm text-ink-soft mb-5">
              You&apos;ll be signed out in{' '}
              <span className="tabular-nums font-semibold text-ink">{secondsLeft}s</span>{' '}
              due to inactivity.
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleLogout}
                className="flex-1 h-10 rounded-lg border border-ink/15 text-sm text-ink-soft hover:text-ink hover:bg-white/5 transition-colors"
              >
                Sign out now
              </button>
              <button
                type="button"
                onClick={reset}
                autoFocus
                className="flex-1 h-10 rounded-lg bg-blue text-white text-sm font-medium hover:bg-blue/90 transition-colors"
              >
                Stay signed in
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
