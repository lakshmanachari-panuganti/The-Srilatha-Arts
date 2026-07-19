/**
 * Facebook icon. Lucide v1.0 removed brand icons (Instagram, Facebook,
 * YouTube), so this is an inline SVG drawn to match lucide's stroke style
 * (1.5px round-cap stroke, 24×24 viewBox, currentColor) — visually
 * indistinguishable from the previous `lucide-react` export it replaces.
 */
export default function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  )
}
