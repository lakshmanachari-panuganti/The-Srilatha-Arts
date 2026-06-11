'use client'
import { useState } from 'react'
import { Upload, X } from 'lucide-react'
import { getApiBase, getCsrfToken, getAuthToken } from '@/lib/api'
import { useUserAuth } from '@/stores/userAuth'

// Customer-photo uploader shared by the custom-order form, return-request
// modals, and (eventually) review submissions. Posts to /api/upload/customer
// (auth-required, multipart/form-data, 5 MB cap; backend re-encodes to
// WebP). CSRF token is attached manually because apiFetch can't be used
// for multipart bodies.

const MAX_FILE_BYTES = 5 * 1024 * 1024 // mirror backend cap

interface Props {
  /** Already-uploaded URLs. Owner state - pass to value, receive in onChange. */
  value: string[]
  onChange: (next: string[]) => void
  /** Hard cap; defaults to 5. */
  max?: number
  /** Optional label shown above the slots. */
  label?: string
  /** Optional hint shown below the slots. */
  hint?: string
}

export default function PhotoUploader({ value, onChange, max = 5, label, hint }: Props) {
  const user = useUserAuth((s) => s.user)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')

  async function upload(file: File) {
    if (!user) {
      setErr('Sign in to attach photos.')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setErr('Each photo must be 5 MB or smaller.')
      return
    }
    if (value.length >= max) {
      setErr(`You can attach up to ${max} photos.`)
      return
    }
    setErr('')
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const csrf = await getCsrfToken()
      const authToken = getAuthToken()
      const res = await fetch(`${getApiBase()}/upload/customer`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: fd,
      })
      if (!res.ok) {
        const txt = await res.text()
        throw new Error(txt || `Upload failed (${res.status})`)
      }
      const { url } = (await res.json()) as { url: string }
      onChange([...value, url])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not upload photo')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      {label && <span className="block text-xs uppercase tracking-wider text-ink-mute mb-1.5">{label}</span>}
      <div className="flex flex-wrap gap-2">
        {value.map((url) => (
          <div key={url} className="relative w-20 h-20 rounded-lg overflow-hidden bg-cream-deep border border-ink/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="attachment" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(value.filter((u) => u !== url))}
              aria-label="Remove photo"
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white/90 hover:bg-white flex items-center justify-center"
            >
              <X className="w-3 h-3 text-ink" aria-hidden />
            </button>
          </div>
        ))}
        {user && value.length < max && (
          <label
            className={`w-20 h-20 rounded-lg border border-dashed border-lavender/50 bg-white/40 text-ink-mute flex flex-col items-center justify-center text-xs cursor-pointer hover:bg-white/70 transition-colors ${
              uploading ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            <Upload className="w-4 h-4 mb-1" aria-hidden />
            {uploading ? 'Uploading…' : 'Add'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) upload(f)
                e.target.value = ''
              }}
            />
          </label>
        )}
      </div>
      {!user && (
        <p className="text-xs text-ink-mute mt-1">
          Sign in to attach photos.
        </p>
      )}
      {hint && <p className="text-xs text-ink-mute mt-1">{hint}</p>}
      {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
    </div>
  )
}
