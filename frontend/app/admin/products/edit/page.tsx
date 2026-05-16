'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Upload, Save, Trash2, Loader2, X, AlertCircle } from 'lucide-react'
import { CATEGORIES } from '@/data/categories'
import { getProductById } from '@/data/products'
import { apiFetch, ApiError, getCsrfToken, getApiBase } from '@/lib/api'
import { useAdminAuth } from '@/stores/adminAuth'
import type { Product } from '@/types'

interface ImageEntry {
  preview: string
  url: string | null
  uploading: boolean
  error: string | null
}

async function uploadFile(file: File, category: string, token: string | null): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  // Multipart uploads bypass apiFetch (which is JSON-only), so attach the
  // CSRF token manually here. The backend's csrfGuard runs on every
  // mutating handler including /api/admin/upload.
  const csrf = await getCsrfToken()
  if (csrf) headers['X-CSRF-Token'] = csrf
  const res = await fetch(
    `${getApiBase()}/admin/upload?category=${encodeURIComponent(category || 'general')}`,
    { method: 'POST', credentials: 'include', headers, body: fd },
  )
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || `Upload failed (${res.status})`)
  return (json as { image: { url: string } }).image.url
}

function EditProduct() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const id = searchParams.get('id')
  const { token } = useAdminAuth()
  const tokenRef = useRef(token)
  tokenRef.current = token
  const [product, setProduct] = useState<Product | null | undefined>(undefined)
  const [images, setImages] = useState<ImageEntry[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (id) {
      getProductById(id).then((p) => {
        setProduct(p || null)
        if (p) {
          setImages(
            (p.images || []).map((url) => ({
              preview: url,
              url,
              uploading: false,
              error: null,
            })),
          )
        }
      })
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
        const category = id?.split('-')[0] || 'general'
        try {
          const url = await uploadFile(file, category, tokenRef.current)
          setImages((prev) =>
            prev.map((entry, j) => (j === idx ? { ...entry, url, uploading: false } : entry)),
          )
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Upload failed'
          setImages((prev) =>
            prev.map((entry, j) => (j === idx ? { ...entry, uploading: false, error: msg } : entry)),
          )
        }
      }),
    )
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!product || !id) return
    setSubmitError(null)

    if (images.some((img) => img.uploading)) {
      setSubmitError('Please wait for all images to finish uploading.')
      return
    }
    if (images.some((img) => img.error)) {
      setSubmitError('Some images failed to upload. Remove them and try again.')
      return
    }

    setIsSubmitting(true)
    const formData = new FormData(e.currentTarget)
    const priceRupees = Number(formData.get('price')) || 0
    const body = {
      title: formData.get('title'),
      category: formData.get('category'),
      slug: formData.get('slug'),
      description: formData.get('description'),
      shortDescription: formData.get('shortDescription'),
      price: Math.round(priceRupees * 100),
      displayPrice: priceRupees,
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
      await apiFetch(`/admin/products/${id}`, { method: 'PATCH', body })
      router.push('/admin/products')
    } catch (err) {
      let message = 'Failed to update product'
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

  const handleDelete = async () => {
    if (!id || !confirm('Are you sure you want to delete this product?')) return
    setIsDeleting(true)
    try {
      await apiFetch(`/admin/products/${id}`, { method: 'DELETE' })
      router.push('/admin/products')
    } catch (err) {
      let message = 'Failed to delete product'
      if (err instanceof ApiError) {
        message =
          err.body && typeof err.body === 'object' && 'error' in err.body
            ? String((err.body as { error: unknown }).error)
            : err.message
      } else if (err instanceof Error) {
        message = err.message
      }
      setSubmitError(message)
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
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {isSubmitting ? 'Saving...' : images.some((img) => img.uploading) ? 'Uploading images…' : 'Save Changes'}
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
