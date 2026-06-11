// Mirror of backend `buildSeoSlug` in backend/src/services/blobStorage.ts.
// Kept in lock-step so the "Stored filename" label rendered in the
// admin form matches the name the server will actually write at submit
// time. If the rules diverge, the label becomes a lie.
export function buildSeoSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '')
}

function todayYYYYMMDD(): string {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

/**
 * Compute the filename a product image will be written under, given the
 * AI-generated (or admin-typed) title. The actual server filename may
 * differ by a `-2`, `-3`, … suffix if another product on the same day
 * already claimed the same slug; in that case the label updates after
 * submit when the server returns the real name.
 */
export function expectedProductImageFilename(title: string): string | null {
  const slug = buildSeoSlug(title)
  if (!slug) return null
  return `${slug}-${todayYYYYMMDD()}.webp`
}
