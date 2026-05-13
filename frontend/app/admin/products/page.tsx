import Link from 'next/link'
import { Plus, Search, Filter } from 'lucide-react'
import { PRODUCTS } from '@/data/products' // We'll use local data for now, wire to API in Phase 2
import Image from 'next/image'
import { formatINR } from '@/lib/format'

export default function AdminProductsPage() {
  return (
    <div>
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl text-ink mb-1">Products</h1>
          <p className="text-ink-soft text-sm">Manage your artworks, stock, and pricing.</p>
        </div>
        <Link href="/admin/products/new" className="btn-dark text-sm h-10 px-4">
          <Plus className="w-4 h-4 mr-2" />
          Add Product
        </Link>
      </header>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-mute" />
          <input
            type="text"
            placeholder="Search products..."
            className="w-full pl-10 pr-4 h-10 bg-white border border-ink/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent"
          />
        </div>
        <button className="flex items-center gap-2 px-4 h-10 bg-white border border-ink/10 rounded-lg text-sm text-ink hover:bg-paper transition-colors">
          <Filter className="w-4 h-4 text-ink-mute" />
          Filter
        </button>
      </div>

      {/* Products Table */}
      <div className="bg-white border border-ink/10 rounded-xl overflow-x-auto">
        <table className="w-full text-left text-sm text-ink min-w-[800px]">
          <thead className="bg-paper border-b border-ink/10 text-ink-soft font-medium">
            <tr>
              <th className="px-6 py-4">Product</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Price</th>
              <th className="px-6 py-4">Category</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/5">
            {PRODUCTS.map((product) => (
              <tr key={product.id} className="hover:bg-lavender-pastel/10 transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-4">
                    <div className="relative w-12 h-12 rounded-lg bg-cream-deep overflow-hidden shrink-0 border border-ink/5">
                      <Image
                        src={product.images[0] || '/images/logo.png'}
                        alt={product.title}
                        fill
                        className="object-contain p-1"
                      />
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
                      In Stock
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10">
                      Out of Stock
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 font-medium">
                  {formatINR(product.price)}
                </td>
                <td className="px-6 py-4 capitalize">
                  {product.category.replace('-', ' ')}
                </td>
                <td className="px-6 py-4 text-right">
                  <Link
                    href={`/admin/products/${product.id}`}
                    className="text-terracotta hover:text-plum font-medium transition-colors"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
