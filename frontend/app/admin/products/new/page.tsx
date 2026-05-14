'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Upload, Plus, X, Loader2, AlertCircle } from 'lucide-react'
import { CATEGORIES } from '@/data/categories'
import { apiFetch, ApiError } from '@/lib/api'

interface ImageEntry {
  preview: string
  url: string | null
  uploading: boolean
  error: string | null
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:7071/api'

async function uploadFile(file: File, category: string): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(
    `${API_BASE}/admin/upload?category=${encodeURIComponent(category || 'general')}`,
    { method: 'POST', credentials: 'include', body: fd },
  )
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || `Upload failed (${res.status})`)
  return (json as { image: { url: string } }).image.url
}

export default function AdminNewProductPage() {
  const router = useRouter()
  const [images, setImages] = useState<ImageEntry[]>([])
  const [category, setCategory] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const categoryRef = useRef(category)
  categoryRef.current = category

  const handleFilesSelected = async (files: FileList) => {
    const newEntries: ImageEntry[] = Array.from(files).map((f) => ({
      preview: URL.createObjectURL(f),
      url: null,
      uploading: true,
      error: null,
    }))
    setImages((prev) => [...prev, ...newEntries])

    const startIndex = images.length
    await Promise.all(
      Array.from(files).map(async (file, i) => {
        const idx = startIndex + i
        try {
          const url = await uploadFile(file, categoryRef.current)
          setImages((prev) =>
            prev.map((entry, j) =>
              j === idx ? { ...entry, url, uploading: false } : entry,
            ),
          )
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Upload failed'
          setImages((prev) =>
            prev.map((entry, j) =>
              j === idx ? { ...entry, uploading: false, error: msg } : entry,
            ),
          )
        }
      }),
    )
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitError(null)

    const pending = images.some((img) => img.uploading)
    if (pending) {
      setSubmitError('Please wait for all images to finish uploading.')
      return
    }
    const failed = images.some((img) => img.error)
    if (failed) {
      setSubmitError('Some images failed to upload. Remove them and try again.')
      return
    }

    setIsSubmitting(true)
    const formData = new FormData(e.currentTarget)
    const priceRupees = Number(formData.get('price')) || 0
    const body = {
      title: formData.get('title'),
      category,
      slug: formData.get('slug'),
      description: formData.get('description'),
      shortDescription: formData.get('shortDescription'),
      price: Math.round(priceRupees * 100),      // store in paise
      displayPrice: priceRupees,                 // store display value in rupees
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
      imageUrl: images[0]?.url ?? '',
      additionalImages: images.slice(1).map((img) => img.url).filter(Boolean),
    }

    try {
      await apiFetch('/admin/products', { method: 'POST', body })
      router.push('/admin/products')
    } catch (err) {
      let message = 'Failed to create product'
      if (err instanceof ApiError) {
        message =
          err.body && typeof err.body === 'object' && 'error' in err.body
            ? String((err.body as { error: unknown }).error)
            : err.message
      } else if (err instanceof Error) {
        message = err.message
      }
      setSubmitError(message)
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
                onChange={(e) => { if (e.target.files) handleFilesSelected(e.target.files) }}
              />
              <Upload className="w-8 h-8 text-ink-mute mx-auto mb-3" />
              <p className="text-sm font-medium text-ink mb-1">Drop images here or click to upload</p>
              <p className="text-xs text-ink-mute">PNG, JPG, WebP · max 5 MB each</p>
            </label>
            {images.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                {images.map((entry, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-ink/10 group bg-white">
                    <img src={entry.preview} alt={`Preview ${i}`} className="object-cover w-full h-full" />
                    {entry.uploading && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      </div>
                    )}
                    {entry.error && (
                      <div className="absolute inset-0 bg-red-900/70 flex flex-col items-center justify-center p-2">
                        <AlertCircle className="w-5 h-5 text-white mb-1" />
                        <p className="text-white text-xs text-center leading-tight">{entry.error}</p>
                      </div>
                    )}
                    {!entry.uploading && (
                      <button
                        type="button"
                        onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute top-2 right-2 bg-white/90 p-1.5 rounded-full text-red-600 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white shadow-sm"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
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
            {submitError && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}
            <button
              disabled={isSubmitting || images.some((img) => img.uploading)}
              className="btn-dark w-full justify-center text-sm h-11 mt-2 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              {isSubmitting ? 'Creating...' : images.some((img) => img.uploading) ? 'Uploading images…' : 'Create Product'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
