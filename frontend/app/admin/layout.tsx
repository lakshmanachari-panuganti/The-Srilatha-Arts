import Link from 'next/link'
import { Package, ShoppingBag, LayoutDashboard, Tag, MessageSquare, Ticket, Image as ImageIcon, Settings, LogOut } from 'lucide-react'

const navItems = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Orders', href: '/admin/orders', icon: ShoppingBag },
  { name: 'Products', href: '/admin/products', icon: Package },
  { name: 'Custom Orders', href: '/admin/custom-orders', icon: ImageIcon },
  { name: 'Reviews', href: '/admin/reviews', icon: MessageSquare },
  { name: 'Coupons', href: '/admin/coupons', icon: Ticket },
  { name: 'Announcements', href: '/admin/announcements', icon: Tag },
  { name: 'Settings', href: '/admin/settings', icon: Settings },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8F7FC] flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-ink/5 flex flex-col fixed inset-y-0 left-0 z-20">
        <div className="p-6 border-b border-ink/5">
          <Link href="/" className="font-serif text-2xl text-ink tracking-wide">
            Srilatha<em className="italic gold-text ml-1.5">Art</em>
          </Link>
          <p className="text-xs text-ink-mute mt-1 uppercase tracking-wider font-semibold">Admin Workspace</p>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-ink-soft rounded-lg hover:bg-lavender-pastel/30 hover:text-plum transition-colors"
            >
              <item.icon className="w-4 h-4" />
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-ink/5">
          <button className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-terracotta rounded-lg hover:bg-terracotta/10 w-full transition-colors">
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
