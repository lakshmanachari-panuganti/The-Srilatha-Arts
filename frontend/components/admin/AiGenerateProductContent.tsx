'use client'

import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { apiFetch, ApiError } from '@/lib/api'

// Fields the AI is allowed to write. Mirrors the backend response shape
// from POST /api/admin/products/ai-generate. Other product fields (price,
// category, stock, featured flags, etc.) are deliberately out of scope.
export interface AiProductContent {
  title: string
  shortDescription: string
  description: string
  material: string
  careInstructions: string
}

interface Props {
  /** First uploaded image URL — the source the AI analyses. Disable
   *  state is driven from whether this is set. */
  imageUrl: string | null
  /** Current values of the AI-writable fields. Used to decide whether to
   *  prompt the admin before overwriting existing content. */
  current: AiProductContent
  /** Called with the AI-generated content once the admin has agreed to
   *  apply it. Parent owns the form state. */
  onGenerated: (content: AiProductContent) => void
}

type Status = 'idle' | 'confirming' | 'loading' | 'success' | 'error'

// Returns true if any of the AI-writable fields already contain text.
// We intentionally do not consider "whitespace-only" as content — an
// admin who left a stray space deserves a quiet overwrite.
function hasExistingContent(c: AiProductContent): boolean {
  return Boolean(
    c.title.trim() ||
      c.shortDescription.trim() ||
      c.description.trim() ||
      c.material.trim() ||
      c.careInstructions.trim(),
  )
}

export default function AiGenerateProductContent({ imageUrl, current, onGenerated }: Props) {
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')

  const disabled = !imageUrl || status === 'loading'

  async function callApi() {
    setStatus('loading')
    setMessage('')
    try {
      const content = await apiFetch<AiProductContent>('/admin/products/ai-generate', {
        method: 'POST',
        body: { imageUrl },
      })
      onGenerated(content)
      setStatus('success')
      setMessage('Product details generated successfully.')
    } catch (err) {
      let msg = 'Unable to generate product details. Please try again.'
      if (err instanceof ApiError) {
        if (err.status === 503) msg = 'AI generation is not configured on the server.'
        else if (err.status === 504) msg = 'AI generation timed out. Please try again.'
        else if (err.body && typeof err.body === 'object' && 'error' in err.body) {
          const apiMsg = String((err.body as { error: unknown }).error)
          if (apiMsg) msg = apiMsg
        }
      } else if (err instanceof Error && err.message) {
        msg = err.message
      }
      setStatus('error')
      setMessage(msg)
    }
  }

  function onClick() {
    if (disabled) return
    if (hasExistingContent(current)) {
      // Surface inline confirmation instead of a window.confirm so we can
      // style it consistently with the rest of the admin chrome.
      setStatus('confirming')
      setMessage('')
      return
    }
    callApi()
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={
          !imageUrl
            ? 'Upload at least one product image first'
            : 'Generate title, descriptions, material, and care instructions from the uploaded image'
        }
        aria-label="Generate product details from image"
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold text-white bg-gradient-to-br from-lavender to-lavender-pastel hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
      >
        {status === 'loading' ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            Analyzing artwork…
          </>
        ) : (
          <>
            <Sparkles className="w-3.5 h-3.5" aria-hidden />
            Generate Product Details
          </>
        )}
      </button>

      {status === 'confirming' && (
        <div
          role="dialog"
          aria-modal="false"
          className="w-full max-w-sm rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          <p className="font-medium mb-1">Some fields already contain data.</p>
          <p className="text-amber-900/80 mb-3">
            Do you want to replace the existing content with AI-generated content?
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setStatus('idle')}
              className="h-8 px-3 text-xs rounded-md text-amber-900 hover:bg-amber-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={callApi}
              className="h-8 px-3 text-xs rounded-md bg-amber-700 text-white font-medium hover:bg-amber-800"
            >
              Replace Content
            </button>
          </div>
        </div>
      )}

      {status === 'success' && message && (
        <p role="status" className="text-xs text-emerald-700">{message}</p>
      )}
      {status === 'error' && message && (
        <p role="alert" className="text-xs text-rose-700 max-w-sm text-right">
          {message}
        </p>
      )}
    </div>
  )
}
