'use client'

import { ArrowUpRight, ShoppingBag, Package, Users, IndianRupee } from 'lucide-react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { formatINR } from '@/lib/format'
import { apiFetch } from '@/lib/api'
import NotificationAlertsCard from '@/components/admin/NotificationAlertsCard'
import SystemDiagnosticsCard from '@/components/admin/SystemDiagnosticsCard'
import CustomOrdersInboxCard from '@/components/admin/CustomOrdersInboxCard'

interface DashboardStats {
  totalRevenue: number
  ordersLast30Days: number
  activeProducts: number
  totalCustomers: number
  pendingOrders: number
}

function StatSkeleton() {
  return (
    <div className="bg-plum-light rounded-xl p-6 border border-ink/10 shadow-sm animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 rounded-full bg-lavender-pastel/30" />
        <div className="h-5 w-12 rounded-full bg-lavender-pastel/30" />
      </div>
      <div className="h-3 w-24 bg-lavender-pastel/30 rounded mb-2" />
      <div className="h-7 w-32 bg-lavender-pastel/30 rounded" />
    </div>
  )
}

export default function AdminDashboardPage() {
  const { data: stats, isLoading, isError } = useQuery<DashboardStats>({
    queryKey: ['admin-stats'],
    queryFn: () => apiFetch<DashboardStats>('/admin/stats'),
    staleTime: 60_000,
  })

  const statCards = [
    {
      name: 'Total Revenue',
      value: stats ? formatINR(stats.totalRevenue) : '-',
      icon: IndianRupee,
    },
    {
      name: 'Orders (30d)',
      value: stats ? String(stats.ordersLast30Days) : '-',
      icon: ShoppingBag,
    },
    {
      name: 'Active Products',
      value: stats ? String(stats.activeProducts) : '-',
      icon: Package,
    },
    {
      name: 'Total Customers',
      value: stats ? String(stats.totalCustomers) : '-',
      icon: Users,
    },
  ]

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-serif text-3xl text-ink mb-1">Overview</h1>
        <p className="text-ink-soft text-sm">Welcome back to the Srilatha Art studio dashboard.</p>
      </header>

      {/* System Diagnostics — always renders; surfaces App Settings gaps,
          live SMTP probe, queue depth, and any silent-failure footprint. */}
      <SystemDiagnosticsCard />

      {/* Notification Alerts — only renders when there are open alerts. */}
      <NotificationAlertsCard />

      {/* Custom Order Inbox — highlights newly arrived customer inquiries so
          they're impossible to miss at a glance. Amber-tinted when there is
          work to do; muted when the inbox is clear. */}
      <CustomOrdersInboxCard />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
          : statCards.map((stat) => (
              <div key={stat.name} className="bg-plum-light rounded-xl p-6 border border-ink/10 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-full bg-lavender-pastel/30 flex items-center justify-center text-plum">
                    <stat.icon className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-sm text-ink-soft mb-1">{stat.name}</p>
                <p className="text-2xl font-serif text-ink">{isError ? '-' : stat.value}</p>
              </div>
            ))}
      </div>

      {/* Quick Actions & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <h2 className="font-serif text-xl text-ink mb-4">Recent Orders</h2>
          <div className="bg-plum-light border border-ink/10 rounded-xl p-8 text-center">
            <ShoppingBag className="w-8 h-8 text-ink-mute mx-auto mb-3" />
            <p className="text-ink font-medium mb-1">Check your orders dashboard</p>
            <p className="text-sm text-ink-soft mb-4">
              {isLoading
                ? 'Loading orders…'
                : isError
                  ? 'Could not load order data.'
                  : stats && stats.pendingOrders > 0
                    ? `You have ${stats.pendingOrders} order${stats.pendingOrders !== 1 ? 's' : ''} waiting to be packed.`
                    : 'No orders currently waiting to be packed.'}
            </p>
            <Link href="/admin/orders" className="btn-dark inline-flex text-sm h-9 px-4">
              View Orders
            </Link>
          </div>
        </div>
        
        <div>
          <h2 className="font-serif text-xl text-ink mb-4">Quick Links</h2>
          <div className="bg-plum-light border border-ink/10 rounded-xl overflow-hidden divide-y divide-ink/5">
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
