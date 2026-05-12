export default function SectionDivider() {
  return (
    <div className="flex items-center justify-center my-10 lg:my-16" aria-hidden>
      <span className="h-px w-12 bg-gradient-to-r from-transparent to-gold/40" />
      <svg viewBox="0 0 24 24" className="w-5 h-5 mx-3 text-gold" aria-hidden>
        <circle cx="12" cy="12" r="2" fill="currentColor" />
        <circle cx="12" cy="4" r="1" fill="currentColor" opacity="0.6" />
        <circle cx="12" cy="20" r="1" fill="currentColor" opacity="0.6" />
        <circle cx="4" cy="12" r="1" fill="currentColor" opacity="0.6" />
        <circle cx="20" cy="12" r="1" fill="currentColor" opacity="0.6" />
      </svg>
      <span className="h-px w-12 bg-gradient-to-l from-transparent to-gold/40" />
    </div>
  )
}
