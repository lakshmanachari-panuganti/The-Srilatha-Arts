'use client'

import { Search, Users, Mail, Phone, Loader2 } from 'lucide-react'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { formatINR, formatDate } from '@/lib/format'

interface Customer {
  id: string
  email: string
  name: string
  phone?: string
  picture?: string
  authProvider: 'google' | 'local' | 'unknown'
  createdAt?: string
  lastLogin?: string
  orderCount: number
  totalSpent: number
  lastOrder?: string
}

interface CustomersResponse {
  customers: Customer[]
  total: number
}

const PROVIDER_LABEL: Record<Customer['authProvider'], string> = {
  google: 'Google',
  local: 'Email',
  unknown: 'Account',
}

const PROVIDER_STYLE: Record<Customer['authProvider'], string> = {
  google: 'bg-blue/15 text-blue ring-blue/30',
  local: 'bg-indigo/15 text-indigo ring-indigo/30',
  unknown: 'bg-white/5 text-ink-soft ring-white/10',
}

export default function AdminCustomersPage() {
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Debounce search by 350ms so we don't fire a request on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const { data, isLoading, isError, error } = useQuery<CustomersResponse>({
    queryKey: ['admin-customers', debouncedSearch],
    queryFn: () =>
      apiFetch<CustomersResponse>('/admin/customers', {
        query: debouncedSearch ? { q: debouncedSearch } : undefined,
      }),
    staleTime: 30_000,
  })

  const customers = data?.customers ?? []
  const total = data?.total ?? 0

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-serif text-3xl text-ink mb-1">Customers</h1>
        <p className="text-ink-soft text-sm">
          {isLoading
            ? 'Loading registered customers…'
            : `${total} registered customer${total === 1 ? '' : 's'}.`}
        </p>
      </header>

      <div className="relative max-w-md mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-mute" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by name, email, or phone..."
          className="w-full pl-10 pr-4 h-10 bg-plum-light border border-ink/10 rounded-lg text-sm text-ink placeholder:text-ink-mute focus:outline-none focus:ring-2 focus:ring-blue focus:border-transparent"
        />
      </div>

      {isLoading && (
        <div className="bg-plum-light border border-ink/10 rounded-xl p-8 flex items-center justify-center gap-3">
          <Loader2 className="w-4 h-4 animate-spin text-blue" />
          <span className="text-sm text-ink-soft">Loading customers…</span>
        </div>
      )}

      {isError && !isLoading && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-6">
          <p className="text-sm text-rose-200 font-medium">
            Failed to load customers
          </p>
          <p className="text-xs text-rose-300/80 mt-1">
            {error instanceof Error ? error.message : 'Unexpected error'}
          </p>
        </div>
      )}

      {!isLoading && !isError && (
        <div className="space-y-4">
          {customers.map((cust) => {
            const initials =
              cust.name
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((n) => n[0]?.toUpperCase())
                .join('') || cust.email[0]?.toUpperCase()
            return (
              <div
                key={cust.id}
                className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-5 hover:border-blue/30 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {cust.picture ? (
                    <Image
                      src={cust.picture}
                      alt={cust.name}
                      width={40}
                      height={40}
                      className="w-10 h-10 rounded-full object-cover shrink-0"
                      unoptimized
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-blue/20 text-blue flex items-center justify-center font-bold text-sm shrink-0">
                      {initials}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-ink truncate">{cust.name}</h3>
                      <span
                        className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ring-inset ${PROVIDER_STYLE[cust.authProvider]}`}
                      >
                        {PROVIDER_LABEL[cust.authProvider]}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-mute mt-1">
                      <span className="flex items-center gap-1 min-w-0">
                        <Mail className="w-3 h-3 shrink-0" />
                        <span className="truncate">{cust.email}</span>
                      </span>
                      {cust.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {cust.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm shrink-0">
                    <div className="text-center">
                      <p className="font-medium text-ink">{cust.orderCount}</p>
                      <p className="text-xs text-ink-mute">Orders</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-ink">
                        {formatINR(cust.totalSpent)}
                      </p>
                      <p className="text-xs text-ink-mute">Spent</p>
                    </div>
                    <div className="text-center hidden md:block">
                      <p className="font-medium text-ink">
                        {cust.lastOrder ? formatDate(cust.lastOrder) : '-'}
                      </p>
                      <p className="text-xs text-ink-mute">Last order</p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          {customers.length === 0 && (
            <div className="bg-plum-light border border-ink/10 rounded-xl p-8 text-center">
              <Users className="w-8 h-8 text-ink-mute mx-auto mb-3" />
              <p className="text-ink font-medium">
                {debouncedSearch ? 'No customers match your search' : 'No customers yet'}
              </p>
              <p className="text-xs text-ink-mute mt-1">
                {debouncedSearch
                  ? 'Try a different name, email, or phone fragment.'
                  : 'Customers will appear here once people sign in with Google or register with email & password.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
