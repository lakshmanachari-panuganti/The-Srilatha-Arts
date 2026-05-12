import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-svh flex flex-col items-center justify-center px-6 text-center">
      <p className="eyebrow mb-3">404</p>
      <h1 className="display text-5xl md:text-6xl mb-4">
        This canvas is <em className="italic">blank</em>
      </h1>
      <p className="text-ink-soft max-w-md mb-8">
        The page you were looking for could not be found. Perhaps it was reimagined into something new.
      </p>
      <Link href="/" className="btn-dark">
        Back to the gallery
      </Link>
    </main>
  )
}
