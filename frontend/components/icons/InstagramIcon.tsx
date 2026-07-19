/**
 * Instagram icon. Lucide v1.0 removed brand icons (Instagram, Facebook,
 * YouTube), so this is an inline SVG drawn to match lucide's stroke style
 * (1.5px round-cap stroke, 24×24 viewBox, currentColor) — visually
 * indistinguishable from the previous `lucide-react` export it replaces.
 */
export default function InstagramIcon({ className }: { className?: string }) {
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
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}
