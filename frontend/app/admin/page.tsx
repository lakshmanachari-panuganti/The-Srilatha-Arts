import { ArrowUpRight, ShoppingBag, Package, Users, IndianRupee } from 'lucide-react'
import Link from 'next/link'
import { formatINR } from '@/lib/format'

// Mock metrics
const STATS = [
  { name: 'Total Revenue', value: formatINR(1250000), change: '+12.5%', icon: IndianRupee },
  { name: 'Orders (30d)', value: '142', change: '+8.2%', icon: ShoppingBag },
  { name: 'Active Products', value: '48', change: '0%', icon: Package },
  { name: 'Total Customers', value: '850', change: '+15.3%', icon: Users },
]

export default function AdminDashboardPage() {
  return (
    <div>
      <header className="mb-8">
        <h1 className="font-serif text-3xl text-ink mb-1">Overview</h1>
        <p className="text-ink-soft text-sm">Welcome back to the Srilatha Art studio dashboard.</p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {STATS.map((stat) => (
          <div key={stat.name} className="bg-white rounded-xl p-6 border border-ink/10 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-full bg-lavender-pastel/30 flex items-center justify-center text-plum">
                <stat.icon className="w-5 h-5" />
              </div>
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                stat.change.startsWith('+') ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-600'
              }`}>
                {stat.change}
              </span>
            </div>
            <p className="text-sm text-ink-soft mb-1">{stat.name}</p>
            <p className="text-2xl font-serif text-ink">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <h2 className="font-serif text-xl text-ink mb-4">Recent Orders</h2>
          <div className="bg-white border border-ink/10 rounded-xl p-8 text-center">
            <ShoppingBag className="w-8 h-8 text-ink-mute mx-auto mb-3" />
            <p className="text-ink font-medium mb-1">Check your orders dashboard</p>
            <p className="text-sm text-ink-soft mb-4">You have 3 orders waiting to be packed.</p>
            <Link href="/admin/orders" className="btn-dark inline-flex text-sm h-9 px-4">
              View Orders
            </Link>
          </div>
        </div>
        
        <div>
          <h2 className="font-serif text-xl text-ink mb-4">Quick Links</h2>
          <div className="bg-white border border-ink/10 rounded-xl overflow-hidden divide-y divide-ink/5">
            <Link href="/admin/products/new" className="flex items-center justify-between p-4 hover:bg-lavender-pastel/10 transition-colors group">
              <span className="text-sm font-medium text-ink group-hover:text-plum transition-colors">Add new artwork</span>
              <ArrowUpRight className="w-4 h-4 text-ink-mute group-hover:text-plum transition-colors" />
            </Link>
            <Link href="/admin/announcements" className="flex items-center justify-between p-4 hover:bg-lavender-pastel/10 transition-colors group">
              <span className="text-sm font-medium text-ink group-hover:text-plum transition-colors">Update banner</span>
              <ArrowUpRight className="w-4 h-4 text-ink-mute group-hover:text-plum transition-colors" />
            </Link>
            <Link href="/admin/custom-orders" className="flex items-center justify-between p-4 hover:bg-lavender-pastel/10 transition-colors group">
              <span className="text-sm font-medium text-ink group-hover:text-plum transition-colors">Review inquiries</span>
              <ArrowUpRight className="w-4 h-4 text-ink-mute group-hover:text-plum transition-colors" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
