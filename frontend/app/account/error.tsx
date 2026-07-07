'use client'
import Link from 'next/link'
import { useEffect } from 'react'

// Route-scoped error boundary for /account/*. Scoping this here means an
// exception on (e.g.) the order-detail page doesn't blow up the whole site
// - the shell (header, cart, nav) stays alive and the customer gets a
// clear path back to their account overview.
export default function AccountError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[account] route error:', error)
  }, [error])

  return (
    <main className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center">
      <p className="eyebrow mb-3">Something went wrong</p>
      <h1 className="display text-3xl md:text-4xl mb-4">
        We couldn&apos;t load this <em className="italic">page</em>
      </h1>
      <p className="text-ink-soft max-w-md mb-8">
        The rest of your account is unaffected. Please try again, or head back to your account
        overview.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button onClick={reset} className="btn-dark">
          Try again
        </button>
        <Link
          href="/account"
          className="inline-flex items-center justify-center h-11 px-6 rounded-lg border border-ink/15 text-sm text-ink-soft hover:text-ink hover:bg-white/5 transition-colors"
        >
          Back to my account
        </Link>
      </div>
      {error.digest && (
        <p className="mt-6 text-xs text-ink-mute font-mono">ref {error.digest}</p>
      )}
    </main>
  )
}
