'use client'

import { TrendingUp, ShoppingBag, Users, Ticket, IndianRupee, Package, Star } from 'lucide-react'

const STATS = [
  { label: 'Revenue (May)', value: '₹0', change: '', icon: IndianRupee, color: 'text-green-700' },
  { label: 'Orders (May)', value: '0', change: '', icon: ShoppingBag, color: 'text-blue-700' },
  { label: 'Avg Order Value', value: '₹0', change: '', icon: TrendingUp, color: 'text-purple-700' },
  { label: 'Active Customers', value: '0', change: '', icon: Users, color: 'text-amber-700' },
]

export default function AdminAnalyticsPage() {
  return (
    <div>
      <header className="mb-8">
        <h1 className="font-serif text-3xl text-ink mb-1">Analytics</h1>
        <p className="text-ink-soft text-sm">Sales, traffic, and performance metrics.</p>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {STATS.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="bg-plum-light border border-ink/10 rounded-lg p-4 md:p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-ink-mute font-medium">{stat.label}</span>
                <Icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <p className={`text-2xl font-serif font-medium ${stat.color}`}>{stat.value}</p>
              {stat.change && <p className="text-xs text-green-600 mt-1">{stat.change}</p>}
            </div>
          )
        })}
      </div>

      {/* Placeholder charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-plum-light border border-ink/10 rounded-lg p-6">
          <h2 className="font-serif text-lg text-ink mb-4">Revenue Trend</h2>
          <div className="h-48 flex items-center justify-center text-ink-mute text-sm border-2 border-dashed border-ink/10 rounded-lg">
            <div className="text-center">
              <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Chart will appear once orders start coming in</p>
            </div>
          </div>
        </div>
        <div className="bg-plum-light border border-ink/10 rounded-lg p-6">
          <h2 className="font-serif text-lg text-ink mb-4">Orders by Status</h2>
          <div className="h-48 flex items-center justify-center text-ink-mute text-sm border-2 border-dashed border-ink/10 rounded-lg">
            <div className="text-center">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No order data yet</p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Products / Category breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-plum-light border border-ink/10 rounded-lg p-6">
          <h2 className="font-serif text-lg text-ink mb-4">Top Selling Products</h2>
          <div className="text-center py-8 text-ink-mute text-sm">
            <Star className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>Sales data will appear after the first orders</p>
          </div>
        </div>
        <div className="bg-plum-light border border-ink/10 rounded-lg p-6">
          <h2 className="font-serif text-lg text-ink mb-4">Revenue by Category</h2>
          <div className="text-center py-8 text-ink-mute text-sm">
            <Ticket className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>Category breakdown will appear after the first sales</p>
          </div>
        </div>
      </div>
    </div>
  )
}
