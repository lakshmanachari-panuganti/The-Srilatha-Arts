'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Search, Filter, Package, Loader2, AlertCircle } from 'lucide-react'
import Image from 'next/image'
import { formatINR, formatDate } from '@/lib/format'
import { apiFetch } from '@/lib/api'
import type { Product } from '@/types'

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadProducts()
  }, [])

  async function loadProducts() {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch<{ products: Product[] }>('/products')
      setProducts(res.products || [])
    } catch (err) {
      setError('Failed to load products from server. Please check the backend connection.')
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  const filtered = search
    ? products.filter(
        (p) =>
          p.title.toLowerCase().includes(search.toLowerCase()) ||
          p.category.toLowerCase().includes(search.toLowerCase()) ||
          p.id.toLowerCase().includes(search.toLowerCase()),
      )
    : products

  return (
    <div>
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl text-ink mb-1">Products</h1>
          <p className="text-ink-soft text-sm">
            Manage your artworks, stock, and pricing.
            {!loading && <span className="ml-1 font-medium">{products.length} products</span>}
          </p>
        </div>
        <Link href="/admin/products/new" className="btn-dark text-sm h-10 px-4 shrink-0 self-start sm:self-auto">
          <Plus className="w-4 h-4 mr-2" />
          Add Product
        </Link>
      </header>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-mute" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            className="w-full pl-10 pr-4 h-10 bg-plum-light border border-ink/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent"
          />
        </div>
        <button
          onClick={loadProducts}
          className="flex items-center gap-2 px-4 h-10 bg-plum-light border border-ink/10 rounded-lg text-sm text-ink hover:bg-paper transition-colors shrink-0"
        >
          <Filter className="w-4 h-4 text-ink-mute" />
          Refresh
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-plum-light border border-ink/10 rounded-xl p-12 text-center">
          <Loader2 className="w-8 h-8 text-lavender mx-auto mb-3 animate-spin" />
          <p className="text-ink-soft text-sm">Loading products from server...</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
          <p className="text-red-700 font-medium mb-1">Connection Error</p>
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <button onClick={loadProducts} className="btn-dark text-sm h-9 px-4">
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && products.length === 0 && (
        <div className="bg-plum-light border border-ink/10 rounded-xl p-12 text-center">
          <Package className="w-10 h-10 text-ink-mute mx-auto mb-4" />
          <p className="text-ink font-medium mb-1">No products yet</p>
          <p className="text-sm text-ink-soft mb-6">Upload your first artwork to get started.</p>
          <Link href="/admin/products/new" className="btn-dark text-sm h-10 px-5 inline-flex items-center">
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Product
          </Link>
        </div>
      )}

      {/* Products Table */}
      {!loading && !error && filtered.length > 0 && (
        <div className="bg-plum-light border border-ink/10 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-sm text-ink min-w-[700px]">
            <thead className="bg-paper border-b border-ink/10 text-ink-soft font-medium">
              <tr>
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Price</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {filtered.map((product) => (
                <tr key={product.id} className="hover:bg-lavender-pastel/10 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="relative w-12 h-12 rounded-lg bg-cream-deep overflow-hidden shrink-0 border border-ink/5">
                        {product.images?.[0] ? (
                          <Image
                            src={product.images[0]}
                            alt={product.title}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex items-center justify-center w-full h-full">
                            <Package className="w-5 h-5 text-ink-mute" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-ink group-hover:text-plum transition-colors">
                          {product.title}
                        </p>
                        <p className="text-xs text-ink-mute mt-0.5">{product.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {product.inStock ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20">
                        In Stock ({product.stockQty})
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10">
                        Out of Stock
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 font-medium">
                    {formatINR(product.price)}
                    {product.compareAtPrice && (
                      <span className="text-xs text-ink-mute line-through ml-1.5">{formatINR(product.compareAtPrice)}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-ink-soft whitespace-nowrap">
                    {(() => {
                      const iso = product.updatedAt || product.createdAt
                      if (!iso) return <span className="text-ink-mute">-</span>
                      const edited = product.updatedAt && product.updatedAt !== product.createdAt
                      return (
                        <div className="flex flex-col">
                          <span>{formatDate(iso)}</span>
                          <span className="text-[11px] text-ink-mute">
                            {edited ? 'Edited' : 'Added'}
                          </span>
                        </div>
                      )
                    })()}
                  </td>
                  <td className="px-6 py-4 capitalize">
                    {product.category.replace('-', ' ')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/admin/products/edit?id=${product.id}`}
                      className="text-lavender hover:text-lavender-pastel font-medium transition-colors"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
