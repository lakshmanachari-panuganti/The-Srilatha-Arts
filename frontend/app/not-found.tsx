import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-svh flex flex-col items-center justify-center px-6 text-center">
      <p className="text-gold-light/70 tracking-[0.3em] uppercase text-xs mb-3">404</p>
      <h1 className="font-serif text-4xl md:text-5xl mb-4">
        This canvas <span className="gold-text">is blank</span>
      </h1>
      <p className="text-cream/70 max-w-md mb-7">
        The page you were looking for could not be found. Perhaps it was reimagined into something new.
      </p>
      <Link href="/" className="btn-gold">
        Back to the gallery
      </Link>
    </main>
  )
}
