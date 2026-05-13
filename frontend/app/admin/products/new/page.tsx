'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Upload, Plus, X, Loader2 } from 'lucide-react'
import { CATEGORIES } from '@/data/categories'
import { apiFetch } from '@/lib/api'

export default function AdminNewProductPage() {
  const router = useRouter()
  const [images, setImages] = useState<string[]>([])
  const [category, setCategory] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    const formData = new FormData(e.currentTarget)
    const body = {
      title: formData.get('title'),
      category: category,
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
      imageUrl: images[0] || '', // Using object URLs temporarily until upload API is integrated
      additionalImages: images.slice(1)
    }

    try {
      await apiFetch('/admin/products', { method: 'POST', body })
      router.push('/admin/products')
    } catch (err) {
      console.error(err)
      alert('Failed to create product')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <Link href="/admin/products" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-plum mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Products
      </Link>

      <header className="mb-8">
        <h1 className="font-serif text-2xl md:text-3xl text-ink mb-1">Add New Product</h1>
        <p className="text-ink-soft text-sm">Create a new artwork listing for the shop.</p>
      </header>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-6 space-y-5">
            <h2 className="font-serif text-lg text-ink">Basic Information</h2>
            <div>
              <label className="block text-sm font-medium text-ink-soft mb-1.5">Title</label>
              <input type="text" name="title" required placeholder="e.g. Aurora Dot Mandala - 12&quot; Round" className="w-full h-11 px-4 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1.5">Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} required className="w-full h-11 px-4 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender">
                  <option value="">Select category</option>
                  {CATEGORIES.map((c) => (
                    <option key={c.slug} value={c.slug}>{c.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1.5">Slug</label>
                <input type="text" name="slug" placeholder="auto-generated-slug" className="w-full h-11 px-4 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-soft mb-1.5">Description</label>
              <textarea name="description" rows={4} placeholder="Describe the artwork, materials, and story..." className="w-full px-4 py-3 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-soft mb-1.5">Short Description</label>
              <input type="text" name="shortDescription" placeholder="One-line summary for cards" className="w-full h-11 px-4 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent" />
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-6 space-y-5">
            <h2 className="font-serif text-lg text-ink">Pricing & Stock</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1.5">Price (₹)</label>
                <input type="number" name="price" required placeholder="4200" className="w-full h-11 px-4 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1.5">Compare At (₹)</label>
                <input type="number" name="compareAtPrice" placeholder="5500" className="w-full h-11 px-4 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1.5">Stock Qty</label>
                <input type="number" name="stockQty" required placeholder="5" className="w-full h-11 px-4 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender" />
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-6 space-y-5">
            <h2 className="font-serif text-lg text-ink">Product Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1.5">Size</label>
                <input type="text" name="size" placeholder='12 in diameter' className="w-full h-11 px-4 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1.5">Material</label>
                <input type="text" name="material" placeholder="MDF · acrylic · resin" className="w-full h-11 px-4 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1.5">Time to Make</label>
                <input type="text" name="timeToMake" placeholder="5–7 days" className="w-full h-11 px-4 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-soft mb-1.5">Care Instructions</label>
              <textarea name="careInstructions" rows={2} placeholder="How to care for the artwork..." className="w-full px-4 py-3 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender resize-none" />
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
                    setImages(prev => [...prev, ...newImages])
                  }
                }} 
              />
              <Upload className="w-8 h-8 text-ink-mute mx-auto mb-3" />
              <p className="text-sm font-medium text-ink mb-1">Drop images here or click to upload</p>
              <p className="text-xs text-ink-mute">PNG, JPG, WebP · max 5 MB each</p>
            </label>
            {images.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                {images.map((url, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-ink/10 group bg-white">
                    <img src={url} alt={`Preview ${i}`} className="object-cover w-full h-full" />
                    <button 
                      type="button" 
                      onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))} 
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

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Publish */}
          <div className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-6 space-y-4">
            <h2 className="font-serif text-lg text-ink">Publish</h2>
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                <input type="checkbox" name="inStock" className="w-4 h-4 rounded border-ink/20 text-lavender focus:ring-lavender" defaultChecked />
                In Stock
              </label>
              <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                <input type="checkbox" name="featured" className="w-4 h-4 rounded border-ink/20 text-lavender focus:ring-lavender" />
                Featured
              </label>
              <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                <input type="checkbox" name="newArrival" className="w-4 h-4 rounded border-ink/20 text-lavender focus:ring-lavender" />
                New Arrival
              </label>
              <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                <input type="checkbox" name="bestSeller" className="w-4 h-4 rounded border-ink/20 text-lavender focus:ring-lavender" />
                Best Seller
              </label>
              <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                <input type="checkbox" name="onSale" className="w-4 h-4 rounded border-ink/20 text-lavender focus:ring-lavender" />
                On Sale
              </label>
            </div>
            <button disabled={isSubmitting} className="btn-dark w-full justify-center text-sm h-11 mt-2 disabled:opacity-50">
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              {isSubmitting ? 'Creating...' : 'Create Product'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
