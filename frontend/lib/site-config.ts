/**
 * Centralised brand contact info — change here, not in 12 places.
 *
 * Values cross-checked against the existing real-looking strings in
 * app/contact/page.tsx and app/custom-order/page.tsx. The MobileDrawer
 * and Footer were using placeholder fakes (919999999999 / bare
 * instagram.com) before this consolidation.
 */

export const WHATSAPP_NUMBER = '919133266754' // international format, no '+'

export const SOCIAL = {
  instagram: 'https://instagram.com/thesrilathaarts',
  facebook: 'https://facebook.com/thesrilathaarts',
  youtube: 'https://youtube.com/@thesrilathaarts',
} as const

export const INSTAGRAM_HANDLE = '@thesrilathaarts'

/** Build a wa.me link with an optional prefilled message. */
export function whatsappLink(message?: string): string {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}
