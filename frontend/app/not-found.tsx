import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-svh flex flex-col items-center justify-center px-6 text-center">
      <p className="eyebrow mb-3">404</p>
      <h1 className="display text-5xl md:text-6xl mb-4">
        Page <em className="not-italic">not found</em>
      </h1>
      <p className="text-ink-soft max-w-md mb-8">
        We couldn&apos;t find the page you were looking for. The link may be old or the page may have moved.
      </p>
      <Link href="/" className="btn-dark">
        Back to home
      </Link>
    </main>
  )
}
