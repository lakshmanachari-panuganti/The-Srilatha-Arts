'use client'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="min-h-svh flex flex-col items-center justify-center px-6 text-center">
      <p className="eyebrow mb-3">Something went wrong</p>
      <h1 className="display text-4xl md:text-5xl mb-5">
        We hit a small <em className="not-italic">snag</em>
      </h1>
      <p className="text-ink-soft max-w-md mb-8">
        This page didn&apos;t load properly. Please try again, or come back in a minute.
      </p>
      <button onClick={reset} className="btn-dark">
        Try again
      </button>
    </main>
  )
}
