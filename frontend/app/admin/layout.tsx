'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Package, ShoppingBag, LayoutDashboard, Tag, MessageSquare,
  Ticket, Image as ImageIcon, Settings, LogOut, Layers, FolderOpen,
  Users, BarChart3, Archive,
} from 'lucide-react'
import { useAdminAuth } from '@/stores/adminAuth'

const navItems = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Orders', href: '/admin/orders', icon: ShoppingBag },
  { name: 'Products', href: '/admin/products', icon: Package },
  { name: 'Inventory', href: '/admin/inventory', icon: Archive },
  { name: 'Categories', href: '/admin/categories', icon: Layers },
  { name: 'Collections', href: '/admin/collections', icon: FolderOpen },
  { name: 'Custom Orders', href: '/admin/custom-orders', icon: ImageIcon },
  { name: 'Reviews', href: '/admin/reviews', icon: MessageSquare },
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

  // Wait for Zustand hydration from localStorage
  useEffect(() => {
    setHydrated(true)
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  // Do not show the sidebar on the login page
  if (pathname === '/admin/login' || pathname === '/admin/login/') {
    return <>{children}</>
  }

  // Guard: redirect to login if not authenticated (after hydration)
  if (hydrated && !user) {
    router.replace('/admin/login')
    return (
      <div className="min-h-screen bg-plum flex items-center justify-center">
        <div className="animate-pulse text-ink-mute text-sm">Redirecting to login...</div>
      </div>
    )
  }

  // Show loading state while hydrating (prevents flash of login redirect)
  if (!hydrated) {
    return (
      <div className="min-h-screen bg-plum flex items-center justify-center">
        <div className="animate-pulse text-ink-mute text-sm">Loading...</div>
      </div>
    )
  }

  const handleLogout = () => {
    logout()
    router.replace('/admin/login')
  }

  return (
    <div className="min-h-screen bg-plum flex flex-col lg:flex-row">
      {/* Mobile Header */}
      <header className="lg:hidden bg-plum-light border-b border-ink/5 p-4 flex items-center justify-between sticky top-0 z-30">
        <Link href="/" className="font-serif text-xl text-ink tracking-wide">
          Srilatha<em className="italic gold-text ml-1.5">Art</em>
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
                  className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-lavender-pastel/30 text-plum'
                      : 'text-ink-soft hover:bg-lavender-pastel/30 hover:text-plum'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                </Link>
              )
            })}
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-terracotta rounded-lg hover:bg-terracotta/10 w-full transition-colors mt-4"
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
          <Link href="/" className="font-serif text-2xl text-ink tracking-wide">
            Srilatha<em className="italic gold-text ml-1.5">Art</em>
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
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? 'bg-lavender-pastel/30 text-plum'
                    : 'text-ink-soft hover:bg-lavender-pastel/30 hover:text-plum'
                }`}
              >
                <item.icon className="w-4 h-4" />
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
            className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-terracotta rounded-lg hover:bg-terracotta/10 w-full transition-colors"
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
    </div>
  )
}
