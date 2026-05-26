/**
 * Pinterest icon. Lucide doesn't ship one, so this is a minimal inline
 * SVG drawn to match lucide's stroke style (1.5px round-cap stroke,
 * 24×24 viewBox, currentColor) so it sits cleanly next to Instagram /
 * Facebook / YouTube icons in the same row.
 */
export default function PinterestIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" />
      <line x1="8" y1="20" x2="12" y2="11" />
      <path d="M9.5 13.5c.5 1.5 1.5 2 2.7 2 2 0 3.5-1.8 3.5-4.5 0-2.2-1.8-3.8-4.2-3.8-2.7 0-4.5 1.9-4.5 4.5 0 1 .4 1.9 1 2.5" />
    </svg>
  )
}
