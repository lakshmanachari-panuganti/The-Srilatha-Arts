'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Upload, Save, Trash2, Loader2 } from 'lucide-react'
import { CATEGORIES } from '@/data/categories'
import { getProductById } from '@/data/products'
import type { Product } from '@/types'

function EditProduct() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  const [product, setProduct] = useState<Product | null | undefined>(undefined)

  useEffect(() => {
    if (id) {
      getProductById(id).then(p => setProduct(p || null))
    } else {
      setProduct(null)
    }
  }, [id])

  if (product === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-lavender animate-spin" />
      </div>
    )
  }

  if (product === null) {
    return (
      <div className="text-center py-20">
        <p className="text-ink-mute mb-4">Product not found</p>
        <Link href="/admin/products" className="btn-dark text-sm h-10 px-4">Back to Products</Link>
      </div>
    )
  }

  return (
    <div>
      <Link href="/admin/products" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-plum mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Products
      </Link>

      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl text-ink mb-1">Edit Product</h1>
          <p className="text-ink-soft text-sm">{product.id}</p>
        </div>
        <button className="text-sm text-red-600 hover:text-red-700 font-medium inline-flex items-center gap-1.5 self-start">
          <Trash2 className="w-4 h-4" /> Delete Product
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-6 space-y-5">
            <h2 className="font-serif text-lg text-ink">Basic Information</h2>
            <div>
              <label className="block text-sm font-medium text-ink-soft mb-1.5">Title</label>
              <input type="text" defaultValue={product.title} className="w-full h-11 px-4 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1.5">Category</label>
                <select defaultValue={product.category} className="w-full h-11 px-4 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender">
                  {CATEGORIES.map((c) => (
                    <option key={c.slug} value={c.slug}>{c.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1.5">Slug</label>
                <input type="text" defaultValue={product.slug} className="w-full h-11 px-4 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-soft mb-1.5">Description</label>
              <textarea rows={4} defaultValue={product.description} className="w-full px-4 py-3 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender resize-none" />
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-6 space-y-5">
            <h2 className="font-serif text-lg text-ink">Pricing & Stock</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1.5">Price (₹)</label>
                <input type="number" defaultValue={product.price} className="w-full h-11 px-4 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1.5">Compare At (₹)</label>
                <input type="number" defaultValue={product.compareAtPrice || ''} className="w-full h-11 px-4 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1.5">Stock Qty</label>
                <input type="number" defaultValue={product.stockQty} className="w-full h-11 px-4 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender" />
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-6 space-y-5">
            <h2 className="font-serif text-lg text-ink">Product Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1.5">Size</label>
                <input type="text" defaultValue={product.size} className="w-full h-11 px-4 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1.5">Material</label>
                <input type="text" defaultValue={product.material} className="w-full h-11 px-4 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1.5">Time to Make</label>
                <input type="text" defaultValue={product.timeToMake} className="w-full h-11 px-4 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-soft mb-1.5">Care Instructions</label>
              <textarea rows={2} defaultValue={product.careInstructions} className="w-full px-4 py-3 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender resize-none" />
            </div>
          </div>

          {/* Images */}
          <div className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-6 space-y-4">
            <h2 className="font-serif text-lg text-ink">Images</h2>
            <div className="border-2 border-dashed border-ink/10 rounded-xl p-8 text-center hover:border-lavender/40 transition-colors cursor-pointer">
              <Upload className="w-8 h-8 text-ink-mute mx-auto mb-3" />
              <p className="text-sm font-medium text-ink mb-1">Drop images here or click to upload</p>
              <p className="text-xs text-ink-mute">PNG, JPG, WebP · max 5 MB each</p>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-6 space-y-4">
            <h2 className="font-serif text-lg text-ink">Status</h2>
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-ink/20 text-lavender focus:ring-lavender" defaultChecked={product.inStock} />
                In Stock
              </label>
              <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-ink/20 text-lavender focus:ring-lavender" defaultChecked={product.featured} />
                Featured
              </label>
              <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-ink/20 text-lavender focus:ring-lavender" defaultChecked={product.isNewArrival} />
                New Arrival
              </label>
              <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-ink/20 text-lavender focus:ring-lavender" defaultChecked={product.isBestSeller} />
                Best Seller
              </label>
              <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-ink/20 text-lavender focus:ring-lavender" defaultChecked={product.isOnSale} />
                On Sale
              </label>
            </div>
            <button className="btn-dark w-full justify-center text-sm h-11 mt-2">
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminEditProductPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <EditProduct />
    </Suspense>
  )
}
