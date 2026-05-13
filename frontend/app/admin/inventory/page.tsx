'use client'

import { useEffect, useState } from 'react'
import { Search, Package, AlertTriangle, Loader2 } from 'lucide-react'
import { formatINR } from '@/lib/format'
import { apiFetch } from '@/lib/api'
import type { Product } from '@/types'

export default function AdminInventoryPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    apiFetch<{ products: Product[] }>('/products')
      .then((res) => setProducts(res.products || []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = search
    ? products.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()))
    : products

  const lowStock = products.filter((p) => p.stockQty <= 3 && p.inStock)
  const outOfStock = products.filter((p) => !p.inStock || p.stockQty === 0)

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-serif text-3xl text-ink mb-1">Inventory</h1>
        <p className="text-ink-soft text-sm">Track stock levels across all artworks.</p>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Products', value: products.length, color: 'text-ink' },
          { label: 'In Stock', value: products.filter((p) => p.inStock).length, color: 'text-green-700' },
          { label: 'Low Stock (≤ 3)', value: lowStock.length, color: 'text-amber-700' },
          { label: 'Out of Stock', value: outOfStock.length, color: 'text-red-700' },
        ].map((stat) => (
          <div key={stat.label} className="bg-plum-light border border-ink/10 rounded-xl p-4">
            <p className="text-xs text-ink-mute mb-1">{stat.label}</p>
            <p className={`text-2xl font-serif font-medium ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-mute" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products..."
          className="w-full pl-10 pr-4 h-10 bg-plum-light border border-ink/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent"
        />
      </div>

      {loading ? (
        <div className="bg-plum-light border border-ink/10 rounded-xl p-12 text-center">
          <Loader2 className="w-8 h-8 text-lavender mx-auto mb-3 animate-spin" />
          <p className="text-ink-soft text-sm">Loading inventory...</p>
        </div>
      ) : (
        <div className="bg-plum-light border border-ink/10 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-sm text-ink min-w-[600px]">
            <thead className="bg-paper border-b border-ink/10 text-ink-soft font-medium">
              <tr>
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Stock</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-lavender-pastel/10 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium text-ink">{p.title}</p>
                    <p className="text-xs text-ink-mute">{p.id}</p>
                  </td>
                  <td className="px-6 py-4 capitalize">{p.category.replace('-', ' ')}</td>
                  <td className="px-6 py-4">
                    <span className={`font-medium ${p.stockQty <= 3 ? 'text-amber-700' : 'text-ink'}`}>
                      {p.stockQty}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {!p.inStock || p.stockQty === 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10">
                        <AlertTriangle className="w-3 h-3" /> Out of Stock
                      </span>
                    ) : p.stockQty <= 3 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20">
                        <AlertTriangle className="w-3 h-3" /> Low Stock
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20">
                        In Stock
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 font-medium">{formatINR(p.price)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-ink-mute">No products found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
