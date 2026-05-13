'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Upload, Save, Trash2, Loader2, X } from 'lucide-react'
import { CATEGORIES } from '@/data/categories'
import { getProductById } from '@/data/products'
import { apiFetch } from '@/lib/api'
import type { Product } from '@/types'

function EditProduct() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const id = searchParams.get('id')
  const [product, setProduct] = useState<Product | null | undefined>(undefined)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!product || !id) return
    setIsSubmitting(true)
    
    const formData = new FormData(e.currentTarget)
    const body = {
      title: formData.get('title'),
      category: formData.get('category'),
      slug: formData.get('slug'),
      description: formData.get('description'),
      shortDescription: formData.get('shortDescription'),
      price: Number(formData.get('price')) || 0,
      compareAtPrice: Number(formData.get('compareAtPrice')) || undefined,
      stockQty: Number(formData.get('stockQty')) || 0,
      size: formData.get('size'),
      material: formData.get('material'),
      timeToMake: formData.get('timeToMake'),
      careInstructions: formData.get('careInstructions'),
      inStock: formData.get('inStock') === 'on',
      featured: formData.get('featured') === 'on',
      isNewArrival: formData.get('newArrival') === 'on',
      isBestSeller: formData.get('bestSeller') === 'on',
      isOnSale: formData.get('onSale') === 'on',
      imageUrl: product.images?.[0] || '', 
      additionalImages: product.images?.slice(1) || []
    }

    try {
      await apiFetch(`/admin/products/${id}`, { method: 'PATCH', body })
      router.push('/admin/products')
    } catch (err) {
      console.error(err)
      alert('Failed to update product')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!id || !confirm('Are you sure you want to delete this product?')) return
    setIsDeleting(true)
    try {
      await apiFetch(`/admin/products/${id}`, { method: 'DELETE' })
      router.push('/admin/products')
    } catch (err) {
      console.error(err)
      alert('Failed to delete product')
      setIsDeleting(false)
    }
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
        <button type="button" onClick={handleDelete} disabled={isDeleting} className="text-sm text-red-600 hover:text-red-700 font-medium inline-flex items-center gap-1.5 self-start disabled:opacity-50">
          {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete Product
        </button>
      </header>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-6 space-y-5">
            <h2 className="font-serif text-lg text-ink">Basic Information</h2>
            <div>
              <label className="block text-sm font-medium text-ink-soft mb-1.5">Title</label>
              <input type="text" name="title" defaultValue={product.title} required className="w-full h-11 px-4 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1.5">Category</label>
                <select name="category" defaultValue={product.category} required className="w-full h-11 px-4 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender">
                  {CATEGORIES.map((c) => (
                    <option key={c.slug} value={c.slug}>{c.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1.5">Slug</label>
                <input type="text" name="slug" defaultValue={product.slug} className="w-full h-11 px-4 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-soft mb-1.5">Description</label>
              <textarea name="description" rows={4} defaultValue={product.description} className="w-full px-4 py-3 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-soft mb-1.5">Short Description</label>
              <input type="text" name="shortDescription" defaultValue={product.shortDescription} className="w-full h-11 px-4 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent" />
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-6 space-y-5">
            <h2 className="font-serif text-lg text-ink">Pricing & Stock</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1.5">Price (₹)</label>
                <input type="number" name="price" defaultValue={product.price} required className="w-full h-11 px-4 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1.5">Compare At (₹)</label>
                <input type="number" name="compareAtPrice" defaultValue={product.compareAtPrice || ''} className="w-full h-11 px-4 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1.5">Stock Qty</label>
                <input type="number" name="stockQty" defaultValue={product.stockQty} required className="w-full h-11 px-4 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender" />
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-6 space-y-5">
            <h2 className="font-serif text-lg text-ink">Product Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1.5">Size</label>
                <input type="text" name="size" defaultValue={product.size} className="w-full h-11 px-4 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1.5">Material</label>
                <input type="text" name="material" defaultValue={product.material} className="w-full h-11 px-4 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1.5">Time to Make</label>
                <input type="text" name="timeToMake" defaultValue={product.timeToMake} className="w-full h-11 px-4 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-soft mb-1.5">Care Instructions</label>
              <textarea name="careInstructions" rows={2} defaultValue={product.careInstructions} className="w-full px-4 py-3 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender resize-none" />
            </div>
          </div>

          {/* Images */}
          <div className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-6 space-y-4">
            <h2 className="font-serif text-lg text-ink">Images</h2>
            <label className="border-2 border-dashed border-ink/10 rounded-xl p-8 text-center hover:border-lavender/40 transition-colors cursor-pointer block relative">
              <input 
                type="file" 
                multiple 
                accept="image/png, image/jpeg, image/webp" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                onChange={(e) => {
                  if (e.target.files) {
                    const newImages = Array.from(e.target.files).map(f => URL.createObjectURL(f))
                    setProduct({ ...product, images: [...(product.images || []), ...newImages] })
                  }
                }} 
              />
              <Upload className="w-8 h-8 text-ink-mute mx-auto mb-3" />
              <p className="text-sm font-medium text-ink mb-1">Drop images here or click to upload</p>
              <p className="text-xs text-ink-mute">PNG, JPG, WebP · max 5 MB each</p>
            </label>
            {(product.images || []).length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                {(product.images || []).map((url, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-ink/10 group bg-white">
                    <img src={url} alt={`Preview ${i}`} className="object-cover w-full h-full" />
                    <button 
                      type="button" 
                      onClick={() => setProduct({
                        ...product,
                        images: (product.images || []).filter((_, idx) => idx !== i)
                      })} 
                      className="absolute top-2 right-2 bg-white/90 p-1.5 rounded-full text-red-600 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white shadow-sm"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-6 space-y-4">
            <h2 className="font-serif text-lg text-ink">Status</h2>
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                <input type="checkbox" name="inStock" className="w-4 h-4 rounded border-ink/20 text-lavender focus:ring-lavender" defaultChecked={product.inStock} />
                In Stock
              </label>
              <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                <input type="checkbox" name="featured" className="w-4 h-4 rounded border-ink/20 text-lavender focus:ring-lavender" defaultChecked={product.featured} />
                Featured
              </label>
              <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                <input type="checkbox" name="newArrival" className="w-4 h-4 rounded border-ink/20 text-lavender focus:ring-lavender" defaultChecked={product.isNewArrival} />
                New Arrival
              </label>
              <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                <input type="checkbox" name="bestSeller" className="w-4 h-4 rounded border-ink/20 text-lavender focus:ring-lavender" defaultChecked={product.isBestSeller} />
                Best Seller
              </label>
              <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                <input type="checkbox" name="onSale" className="w-4 h-4 rounded border-ink/20 text-lavender focus:ring-lavender" defaultChecked={product.isOnSale} />
                On Sale
              </label>
            </div>
            <button disabled={isSubmitting} className="btn-dark w-full justify-center text-sm h-11 mt-2 disabled:opacity-50">
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>
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
