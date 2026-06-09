'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Upload, Plus, X, Loader2, AlertCircle } from 'lucide-react'
import { CATEGORIES } from '@/data/categories'
import { apiFetch, ApiError, getCsrfToken, getApiBase } from '@/lib/api'
import { useAdminAuth } from '@/stores/adminAuth'
import AiGenerateProductContent, {
  type AiProductContent,
  type AiUploadedImage,
} from '@/components/admin/AiGenerateProductContent'

/**
 * Image lifecycle on this page:
 *
 *   user picks file → { file, preview, url:null }      (no upload yet)
 *     ↓
 *   admin clicks "Generate Product Details" → first entry's file is sent
 *     to /admin/products/ai-generate-upload → server optimises to WebP,
 *     runs AI, derives SEO filename from the AI title, writes blob →
 *     the entry transitions to { file:null, url:'https://…/slug-…webp' }
 *     ↓
 *   admin clicks "Create Product" → any remaining file-backed entries
 *     upload via /admin/upload?title=<ai-title-or-typed-title>, which
 *     also derives an SEO filename so every image for the product
 *     shares the slug base.
 *
 * We never write a UUID-named blob during the AI flow - the only blob
 * write for the analysed image is the SEO-named one.
 */
interface ImageEntry {
  preview: string         // object URL or remote URL (used by <img src>)
  file: File | null       // present until the blob is written
  url: string | null      // remote blob URL once stored
  uploading: boolean      // true while a blob write is in flight
  error: string | null
}

// Upload a still-local file via the regular /admin/upload endpoint.
// Used at form-submit time for any image that wasn't the AI-target.
async function uploadFile(
  file: File,
  category: string,
  title: string | undefined,
  token: string | null,
): Promise<{ url: string }> {
  const fd = new FormData()
  fd.append('file', file)
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
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
  return { url: (json as { image: { url: string } }).image.url }
}

export default function AdminNewProductPage() {
  const router = useRouter()
  const { token } = useAdminAuth()
  const [images, setImages] = useState<ImageEntry[]>([])
  const [category, setCategory] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [aiFields, setAiFields] = useState<AiProductContent>({
    title: '',
    shortDescription: '',
    description: '',
    material: '',
    careInstructions: '',
  })
  // SEO filename produced by /ai-generate-upload. Surfaced in the
  // Basic Information panel so the admin can see (and copy) the
  // server-chosen filename without opening the blob URL.
  const [storedFileName, setStoredFileName] = useState<string | null>(null)
  const updateAiField = <K extends keyof AiProductContent>(key: K, value: string) =>
    setAiFields((s) => ({ ...s, [key]: value }))
  const tokenRef = useRef(token)
  tokenRef.current = token

  // Just register the file locally - no blob upload yet. The upload
  // happens either in the AI button (combined endpoint that names the
  // blob from the AI title) or on form submit (regular upload with the
  // typed title as the SEO slug source).
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

  // The AI button writes the analysed image as the FIRST entry, so we
  // splice its returned URL into index 0 (or replace whatever's there).
  const handleAiImageUploaded = (image: AiUploadedImage) => {
    // image.fileName is `<category>/<slug>-YYYYMMDD.webp` - the admin
    // only cares about the basename, strip the directory prefix.
    const basename = image.fileName.split('/').pop() || image.fileName
    setStoredFileName(basename)
    setImages((prev) => {
      if (prev.length === 0) {
        return [{ preview: image.url, file: null, url: image.url, uploading: false, error: null }]
      }
      const first = prev[0]
      // Revoke the object URL we created in handleFilesSelected so we
      // don't leak memory; the preview now points at the remote blob.
      if (first.file && first.preview.startsWith('blob:')) {
        URL.revokeObjectURL(first.preview)
      }
      const next = [...prev]
      next[0] = { preview: image.url, file: null, url: image.url, uploading: false, error: null }
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitError(null)

    const failed = images.some((img) => img.error)
    if (failed) {
      setSubmitError('Some images failed to upload. Remove them and try again.')
      return
    }

    const formData = new FormData(e.currentTarget)
    const title = String(formData.get('title') || '').trim()
    if (!title) {
      setSubmitError('Title is required.')
      return
    }

    setIsSubmitting(true)
    try {
      // Upload anything still held locally. We pass the (now-known)
      // title so the regular upload endpoint names the blob the same
      // way the AI endpoint would.
      const uploadedUrls: (string | null)[] = []
      // Mark all pending entries as uploading up-front so the UI
      // surfaces spinners while submit runs.
      setImages((prev) =>
        prev.map((img) => (img.file ? { ...img, uploading: true, error: null } : img)),
      )
      for (let i = 0; i < images.length; i++) {
        const entry = images[i]
        if (entry.url) {
          uploadedUrls.push(entry.url)
          continue
        }
        if (!entry.file) {
          uploadedUrls.push(null)
          continue
        }
        try {
          const { url } = await uploadFile(entry.file, category, title, tokenRef.current)
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
        category,
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
        additionalImages: uploadedUrls.slice(1).filter((u): u is string => !!u),
      }

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

  // Build the source for the AI button. The AI analyses the FIRST
  // image only; if it's still a local File we use the combined upload+
  // analyse endpoint, otherwise (already stored) we use the URL path.
  const aiSource = (() => {
    const first = images[0]
    if (!first) return null
    if (first.file) return { kind: 'file' as const, file: first.file, category: category || 'general' }
    if (first.url) return { kind: 'url' as const, url: first.url }
    return null
  })()

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
        <div className="lg:col-span-2 space-y-6">
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

          <div className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-6 space-y-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <h2 className="font-serif text-lg text-ink">Basic Information</h2>
              {/* The AI button now ALSO stores the analysed image under
                  an SEO-friendly filename derived from the generated
                  title - so clicking it does upload-+-analyse in one
                  round-trip. */}
              <AiGenerateProductContent
                source={aiSource}
                current={aiFields}
                onGenerated={(c) => setAiFields(c)}
                onUploaded={handleAiImageUploaded}
              />
            </div>
            {storedFileName && (
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1.5">
                  Stored filename
                </label>
                <div className="flex items-center gap-2 px-3 h-10 bg-plum/60 border border-ink/10 rounded-lg text-xs font-mono text-ink-soft break-all">
                  <span className="truncate" title={storedFileName}>{storedFileName}</span>
                </div>
                <p className="text-[11px] text-ink-mute mt-1">
                  SEO-friendly filename generated from the AI title.
                </p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-ink-soft mb-1.5">Title</label>
              <input
                type="text" name="title" required
                value={aiFields.title}
                onChange={(e) => updateAiField('title', e.target.value)}
                placeholder="e.g. Aurora Dot Mandala - 12&quot; Round"
                className="w-full h-11 px-4 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent"
              />
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
              <textarea
                name="description" rows={4}
                value={aiFields.description}
                onChange={(e) => updateAiField('description', e.target.value)}
                placeholder="Describe the artwork, materials, and story..."
                className="w-full px-4 py-3 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-soft mb-1.5">Short Description</label>
              <input
                type="text" name="shortDescription"
                value={aiFields.shortDescription}
                onChange={(e) => updateAiField('shortDescription', e.target.value)}
                placeholder="One-line summary for cards"
                className="w-full h-11 px-4 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent"
              />
            </div>
          </div>

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

          <div className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-6 space-y-5">
            <h2 className="font-serif text-lg text-ink">Product Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1.5">Size</label>
                <input type="text" name="size" placeholder='12 in diameter' className="w-full h-11 px-4 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1.5">Material</label>
                <input
                  type="text" name="material"
                  value={aiFields.material}
                  onChange={(e) => updateAiField('material', e.target.value)}
                  placeholder="MDF · acrylic · resin"
                  className="w-full h-11 px-4 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1.5">Time to Make</label>
                <input type="text" name="timeToMake" placeholder="5–7 days" className="w-full h-11 px-4 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-soft mb-1.5">Care Instructions</label>
              <textarea
                name="careInstructions" rows={2}
                value={aiFields.careInstructions}
                onChange={(e) => updateAiField('careInstructions', e.target.value)}
                placeholder="How to care for the artwork..."
                className="w-full px-4 py-3 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender resize-none"
              />
            </div>
          </div>

        </div>

        <div className="space-y-6">
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
              disabled={isSubmitting}
              className="btn-dark w-full justify-center text-sm h-11 mt-2 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              {isSubmitting ? 'Creating...' : 'Create Product'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
