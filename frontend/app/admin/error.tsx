'use client'
import Link from 'next/link'
import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

// Route-scoped error boundary for /admin/*. A crash inside an admin page
// (bad API payload, thrown effect, etc.) is contained here so the sidebar
// layout stays mounted and the operator can navigate away without a full
// app reload.
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[admin] route error:', error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="max-w-md w-full bg-plum-light border border-ink/10 rounded-2xl p-6 md:p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-amber-500/15 ring-1 ring-inset ring-amber-500/30 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6 text-amber-300" aria-hidden />
        </div>
        <h1 className="font-serif text-2xl text-ink mb-2">This admin page hit a snag</h1>
        <p className="text-sm text-ink-soft mb-6">
          The rest of the admin workspace is fine — try again, or head back to the dashboard.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button
            onClick={reset}
            className="h-10 px-5 rounded-lg bg-blue text-white text-sm font-medium hover:bg-blue/90 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/admin"
            className="h-10 px-5 rounded-lg border border-ink/15 text-sm text-ink-soft hover:text-ink hover:bg-white/5 transition-colors inline-flex items-center justify-center"
          >
            Back to dashboard
          </Link>
        </div>
        {error.digest && (
          <p className="mt-5 text-xs text-ink-mute font-mono">ref {error.digest}</p>
        )}
      </div>
    </div>
  )
}
