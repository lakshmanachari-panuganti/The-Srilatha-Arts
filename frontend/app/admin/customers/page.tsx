'use client'

import { Search, Users, Mail, Phone, ShoppingBag } from 'lucide-react'
import { useState } from 'react'
import { formatINR, formatDate } from '@/lib/format'

const MOCK_CUSTOMERS = [
  { id: 'cust-1', name: 'Aisha Sharma', email: 'aisha@example.com', phone: '+91 98765 43210', orderCount: 4, totalSpent: 1580000, lastOrder: '2026-05-12T14:30:00Z' },
  { id: 'cust-2', name: 'Meera Reddy', email: 'meera@example.com', phone: '+91 87654 32109', orderCount: 2, totalSpent: 740000, lastOrder: '2026-05-08T10:00:00Z' },
  { id: 'cust-3', name: 'Rajesh Kumar', email: 'rajesh.k@example.com', phone: '+91 76543 21098', orderCount: 1, totalSpent: 320000, lastOrder: '2026-04-25T16:00:00Z' },
]

export default function AdminCustomersPage() {
  const [search, setSearch] = useState('')

  const filtered = search
    ? MOCK_CUSTOMERS.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase()),
      )
    : MOCK_CUSTOMERS

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-serif text-3xl text-ink mb-1">Customers</h1>
        <p className="text-ink-soft text-sm">{MOCK_CUSTOMERS.length} registered customers.</p>
      </header>

      <div className="relative max-w-md mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-mute" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full pl-10 pr-4 h-10 bg-plum-light border border-ink/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent"
        />
      </div>

      <div className="space-y-4">
        {filtered.map((cust) => (
          <div
            key={cust.id}
            className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-5 hover:border-lavender/30 transition-colors"
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-lavender-pastel/30 flex items-center justify-center text-plum font-bold text-sm shrink-0">
                {cust.name.split(' ').map((n) => n[0]).join('')}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-ink">{cust.name}</h3>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-mute mt-1">
                  <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{cust.email}</span>
                  <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{cust.phone}</span>
                </div>
              </div>
              <div className="flex items-center gap-6 text-sm shrink-0">
                <div className="text-center">
                  <p className="font-medium text-ink">{cust.orderCount}</p>
                  <p className="text-xs text-ink-mute">Orders</p>
                </div>
                <div className="text-center">
                  <p className="font-medium text-ink">{formatINR(cust.totalSpent / 100)}</p>
                  <p className="text-xs text-ink-mute">Spent</p>
                </div>
                <div className="text-center hidden md:block">
                  <p className="font-medium text-ink">{formatDate(cust.lastOrder)}</p>
                  <p className="text-xs text-ink-mute">Last order</p>
                </div>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="bg-plum-light border border-ink/10 rounded-xl p-8 text-center">
            <Users className="w-8 h-8 text-ink-mute mx-auto mb-3" />
            <p className="text-ink font-medium">No customers found</p>
          </div>
        )}
      </div>
    </div>
  )
}
