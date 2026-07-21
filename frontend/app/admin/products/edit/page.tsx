'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Upload, Save, Trash2, Loader2, X, AlertCircle } from 'lucide-react'
import { CATEGORIES } from '@/data/categories'
import { getProductById } from '@/data/products'
import { apiFetch, ApiError, getCsrfToken, getApiBase } from '@/lib/api'
import { useAdminAuth } from '@/stores/adminAuth'
import AiGenerateProductContent, {
  type AiProductContent,
} from '@/components/admin/AiGenerateProductContent'
import { expectedProductImageFilename } from '@/lib/seoSlug'
import type { Product } from '@/types'

interface ImageEntry {
  preview: string         // remote URL OR local object URL
  file: File | null       // present until the blob is written
  url: string | null      // remote blob URL once stored
  uploading: boolean
  error: string | null
}

async function uploadFile(
  file: File,
  category: string,
  title: string | undefined,
  token: string | null,
): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  // Multipart uploads bypass apiFetch (which is JSON-only), so attach the
  // CSRF token manually here. The backend's csrfGuard runs on every
  // mutating handler including /api/admin/upload.
  const csrf = await getCsrfToken()
  if (csrf) headers['X-CSRF-Token'] = csrf
  const qs = new URLSearchParams({ category: category || 'general' })
  if (title) qs.set('title', title)
  const res = await fetch(`${getApiBase()}/admin/upload?${qs.toString()}`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: fd,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || `Upload failed (${res.status})`)
  return (json as { image: { url: string } }).image.url
}

function EditProduct() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const id = searchParams.get('id')
  const { token, logout } = useAdminAuth()
  const tokenRef = useRef(token)
  tokenRef.current = token
  const [product, setProduct] = useState<Product | null | undefined>(undefined)
  const [images, setImages] = useState<ImageEntry[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitErrorStatus, setSubmitErrorStatus] = useState<number | null>(null)
  // Controlled state for the five AI-writable fields. Seeded from the
  // loaded product so existing copy is preserved; AI generate overwrites
  // these (with confirmation) without touching any other field.
  const [aiFields, setAiFields] = useState<AiProductContent>({
    title: '',
    shortDescription: '',
    description: '',
    material: '',
    careInstructions: '',
  })
  const updateAiField = <K extends keyof AiProductContent>(key: K, value: string) =>
    setAiFields((s) => ({ ...s, [key]: value }))

  const sessionExpired = submitErrorStatus === 401 || submitError === 'Unauthorized'

  useEffect(() => {
    if (id) {
      getProductById(id).then((p) => {
        setProduct(p || null)
        if (p) {
          setImages(
            (p.images || []).map((url) => ({
              preview: url,
              file: null,
              url,
              uploading: false,
              error: null,
            })),
          )
          setAiFields({
            title: p.title || '',
            shortDescription: p.shortDescription || '',
            description: p.description || '',
            material: p.material || '',
            careInstructions: p.careInstructions || '',
          })
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

  // Defer the upload: hold the File locally so AI can analyse it under
  // the combined endpoint (SEO-named blob), or so the form submit can
  // upload it under the typed title's slug. Either path beats writing
  // a UUID-named blob now and renaming it later.
  const handleFilesSelected = (files: FileList) => {
    const newEntries: ImageEntry[] = Array.from(files).map((f) => ({
      preview: URL.createObjectURL(f),
      file: f,
      url: null,
      uploading: false,
      error: null,
    }))
    setImages((prev) => [...prev, ...newEntries])
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!product || !id) return
    setSubmitError(null)

    if (images.some((img) => img.error)) {
      setSubmitError('Some images failed to upload. Remove them and try again.')
      return
    }

    const formData = new FormData(e.currentTarget)
    const title = String(formData.get('title') || '').trim()
    const submitCategory = String(formData.get('category') || product.category || 'general')
    if (!title) {
      setSubmitError('Title is required.')
      return
    }

    setIsSubmitting(true)
    try {
      // Upload anything still held locally (newly-added files for which
      // the admin didn't run AI). Pass the typed title so each new blob
      // is named under the same SEO slug as the AI-stored ones.
      const uploadedUrls: string[] = []
      setImages((prev) =>
        prev.map((img) => (img.file ? { ...img, uploading: true, error: null } : img)),
      )
      for (let i = 0; i < images.length; i++) {
        const entry = images[i]
        if (entry.url) {
          uploadedUrls.push(entry.url)
          continue
        }
        if (!entry.file) continue
        try {
          const url = await uploadFile(entry.file, submitCategory, title, tokenRef.current)
          uploadedUrls.push(url)
          setImages((prev) =>
            prev.map((img, j) =>
              j === i ? { ...img, file: null, url, uploading: false } : img,
            ),
          )
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Upload failed'
          setImages((prev) =>
            prev.map((img, j) => (j === i ? { ...img, uploading: false, error: msg } : img)),
          )
          throw err
        }
      }

      const priceRupees = Number(formData.get('price')) || 0
      const body = {
        title,
        category: submitCategory,
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
        imageUrl: uploadedUrls[0] ?? '',
        additionalImages: uploadedUrls.slice(1),
      }

      await apiFetch(`/admin/products/${id}`, { method: 'PATCH', body })
      router.push('/admin/products')
    } catch (err) {
      let message = 'Failed to update product'
      let status: number | null = null
      if (err instanceof ApiError) {
        status = err.status
        message =
          err.body && typeof err.body === 'object' && 'error' in err.body
            ? String((err.body as { error: unknown }).error)
            : err.message
      } else if (err instanceof Error) {
        message = err.message
      }
      setSubmitError(message)
      setSubmitErrorStatus(status)
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
      let status: number | null = null
      if (err instanceof ApiError) {
        status = err.status
        message =
          err.body && typeof err.body === 'object' && 'error' in err.body
            ? String((err.body as { error: unknown }).error)
            : err.message
      } else if (err instanceof Error) {
        message = err.message
      }
      setSubmitError(message)
      setSubmitErrorStatus(status)
      setIsDeleting(false)
    }
  }

  const handleReLogin = () => {
    logout()
    router.replace('/admin/login?next=' + encodeURIComponent(`/admin/products/edit?id=${id || ''}`))
  }

  // What the AI button operates on. Prefer a freshly-picked local file
  // (so AI sees the latest bytes), fall back to the first existing
  // stored image's URL. No blob is written by the AI call either way -
  // any newly-picked file uploads at form submit, under the final
  // category + AI/typed title.
  const aiSource = (() => {
    const firstFile = images.find((e) => e.file)
    if (firstFile?.file) return { kind: 'file' as const, file: firstFile.file }
    const firstUrl = images[0]?.url
    if (firstUrl) return { kind: 'url' as const, url: firstUrl }
    return null
  })()

  // Filename the next picked image will land under at submit. Only
  // surfaced when there IS a pending local file - existing stored
  // images keep their original filenames untouched.
  const hasPendingFile = images.some((e) => e.file)
  const expectedFileName = hasPendingFile ? expectedProductImageFilename(aiFields.title) : null

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
          {/* Images - placed first so the admin can swap photos before
              touching the rest of the form. */}
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
              <p className="text-xs text-ink-mute">JPG, PNG, WebP · max 10 MB each · converted to WebP automatically</p>
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
                        onClick={() =>
                          setImages((prev) => {
                            const removed = prev[i]
                            if (removed?.file && removed.preview.startsWith('blob:')) {
                              URL.revokeObjectURL(removed.preview)
                            }
                            return prev.filter((_, idx) => idx !== i)
                          })
                        }
                        className="absolute top-2 right-2 bg-white/90 p-1.5 rounded-lg text-red-600 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white shadow-sm"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Basic Info */}
          <div className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-6 space-y-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <h2 className="font-serif text-lg text-ink">Basic Information</h2>
              <AiGenerateProductContent
                source={aiSource}
                current={aiFields}
                onGenerated={(c) => setAiFields(c)}
              />
            </div>
            {expectedFileName && (
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1.5">
                  Filename when saved
                </label>
                <div className="flex items-center gap-2 px-3 h-10 bg-plum/60 border border-ink/10 rounded-lg text-xs font-mono text-ink-soft break-all">
                  <span className="truncate" title={expectedFileName}>{expectedFileName}</span>
                </div>
                <p className="text-[11px] text-ink-mute mt-1">
                  SEO-friendly filename derived from the title. Applied to the newly-added image at save time.
                </p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-ink-soft mb-1.5">Title</label>
              <input
                type="text" name="title" required
                value={aiFields.title}
                onChange={(e) => updateAiField('title', e.target.value)}
                className="w-full h-11 px-4 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent"
              />
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
              <textarea
                name="description" rows={4}
                value={aiFields.description}
                onChange={(e) => updateAiField('description', e.target.value)}
                className="w-full px-4 py-3 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-soft mb-1.5">Short Description</label>
              <input
                type="text" name="shortDescription"
                value={aiFields.shortDescription}
                onChange={(e) => updateAiField('shortDescription', e.target.value)}
                className="w-full h-11 px-4 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent"
              />
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
                <input
                  type="text" name="material"
                  value={aiFields.material}
                  onChange={(e) => updateAiField('material', e.target.value)}
                  className="w-full h-11 px-4 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1.5">Time to Make</label>
                <input type="text" name="timeToMake" defaultValue={product.timeToMake} className="w-full h-11 px-4 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-soft mb-1.5">Care Instructions</label>
              <textarea
                name="careInstructions" rows={2}
                value={aiFields.careInstructions}
                onChange={(e) => updateAiField('careInstructions', e.target.value)}
                className="w-full px-4 py-3 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender resize-none"
              />
            </div>
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
            {submitError && !sessionExpired && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}
            {sessionExpired && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm">
                <div className="flex items-start gap-2 text-red-700 mb-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span className="font-medium">Your admin session expired</span>
                </div>
                <p className="text-red-700/90 text-xs mb-3 pl-6">
                  Sign in again to save your changes. We&apos;ll bring you back to this page.
                </p>
                <button
                  type="button"
                  onClick={handleReLogin}
                  className="w-full h-9 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                >
                  Sign in again
                </button>
              </div>
            )}
            <button
              disabled={isSubmitting}
              className="btn-dark w-full justify-center text-sm h-11 mt-2 disabled:opacity-50"
            >
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
