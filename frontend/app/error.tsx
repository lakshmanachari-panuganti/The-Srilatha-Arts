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
      <p className="text-gold-light/70 tracking-[0.3em] uppercase text-xs mb-3">Something went wrong</p>
      <h1 className="font-serif text-3xl md:text-4xl mb-5">
        A brushstroke <span className="gold-text">slipped</span>
      </h1>
      <p className="text-cream/70 max-w-md mb-7">
        We could not load this page. Please try again — or come back in a moment.
      </p>
      <button onClick={reset} className="btn-gold">
        Try again
      </button>
    </main>
  )
}
