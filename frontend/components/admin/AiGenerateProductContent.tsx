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

// Stable error codes returned by the backend in the JSON body alongside
// HTTP status. Keep in sync with AiErrorCode in
// backend/src/services/aiContentGenerator.ts — each new code MUST get a
// message below.
type AiErrorCode =
  | 'MISSING_CONFIG'
  | 'AUTH_ERROR'
  | 'DEPLOYMENT_NOT_FOUND'
  | 'RATE_LIMIT'
  | 'SERVICE_UNAVAILABLE'
  | 'TIMEOUT'
  | 'IMAGE_PROCESSING_ERROR'
  | 'INVALID_RESPONSE'
  | 'CONTENT_VALIDATION_FAILED'
  | 'NETWORK_ERROR'
  | 'INVALID_INPUT'
  | 'INTERNAL_ERROR'

// Two-line messages: the first line states the problem, the second tells
// the admin what to do. Copy is locked in by spec — do not paraphrase.
const ERROR_MESSAGES: Record<AiErrorCode, string> = {
  MISSING_CONFIG:
    'AI content generation is not configured.\n\nPlease configure Azure OpenAI settings in the application environment variables and try again.',
  AUTH_ERROR:
    'AI content generation failed due to an authentication error.\n\nPlease verify the Azure OpenAI API key and deployment configuration.',
  DEPLOYMENT_NOT_FOUND:
    'Configured AI deployment was not found.\n\nPlease verify the Azure OpenAI deployment name configured for this application.',
  RATE_LIMIT:
    'AI request limit has been reached.\n\nPlease wait a few moments and try again.',
  SERVICE_UNAVAILABLE:
    'Azure OpenAI service is temporarily unavailable.\n\nPlease try again later.',
  TIMEOUT:
    'The AI service did not respond within the expected time.\n\nPlease try again.',
  IMAGE_PROCESSING_ERROR:
    'The uploaded image could not be processed.\n\nPlease upload a clear and valid image.',
  INVALID_RESPONSE:
    'The AI service returned an invalid response format.\n\nPlease generate the content again.',
  CONTENT_VALIDATION_FAILED:
    'The generated content did not meet minimum quality requirements.\n\nRequired fields were missing or incomplete.',
  NETWORK_ERROR:
    'Unable to connect to the AI service.\n\nPlease check network connectivity and try again.',
  INVALID_INPUT:
    'The uploaded image could not be processed.\n\nPlease upload a clear and valid image.',
  INTERNAL_ERROR:
    'An internal application error occurred while generating AI content.\n\nPlease contact the system administrator if the issue persists.',
}

function messageForError(err: unknown): string {
  // Prefer the structured `code` from the backend body. Falls back to
  // status-based heuristics for older deploys that pre-date the typed
  // contract, and finally to a generic message.
  if (err instanceof ApiError) {
    const body = err.body as { code?: AiErrorCode } | null | undefined
    if (body?.code && body.code in ERROR_MESSAGES) {
      return ERROR_MESSAGES[body.code]
    }
    // No typed code from server — fall back on the HTTP status the
    // server returned (matches what the typed mapping would have done).
    if (err.status === 401) return ERROR_MESSAGES.AUTH_ERROR
    if (err.status === 404) return ERROR_MESSAGES.DEPLOYMENT_NOT_FOUND
    if (err.status === 429) return ERROR_MESSAGES.RATE_LIMIT
    if (err.status === 503) return ERROR_MESSAGES.SERVICE_UNAVAILABLE
    if (err.status === 504) return ERROR_MESSAGES.TIMEOUT
  }
  // TypeError from fetch usually means the browser couldn't reach the
  // backend at all (offline, DNS, CORS pre-flight blocked).
  if (err instanceof TypeError && /fetch|network/i.test(err.message)) {
    return ERROR_MESSAGES.NETWORK_ERROR
  }
  return ERROR_MESSAGES.INTERNAL_ERROR
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
      setStatus('error')
      setMessage(messageForError(err))
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
        // The mapped messages are two paragraphs separated by a blank
        // line ("problem.\n\nnext step."); render each line on its own
        // row so the second line reads as actionable guidance, not a
        // run-on sentence. Whitespace-pre-line preserves the breaks
        // without us having to split the string here.
        <div
          role="alert"
          className="text-xs text-rose-700 max-w-sm text-right whitespace-pre-line leading-snug rounded-lg border border-rose-200 bg-rose-50 px-3 py-2"
        >
          {message}
        </div>
      )}
    </div>
  )
}
