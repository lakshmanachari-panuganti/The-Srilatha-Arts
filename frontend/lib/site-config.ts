/**
 * Centralised brand contact info — change here, not in 12 places.
 *
 * Updated 2026-05-26 with the canonical srilatha.art brand handles
 * supplied by the studio. Replaces the legacy `thesrilathaarts`
 * handles that survived in the codebase from the pre-rebrand era.
 */

// International format, no '+'. The 91 prefix is required by wa.me.
export const WHATSAPP_NUMBER = '919133266754'

// Display version for tel: links and visible UI.
export const PHONE_DISPLAY = '+91 91332 66754'
export const PHONE_TEL = '+919133266754'

export const STUDIO_EMAIL = 'studio@srilatha.art'

export const WEBSITE_URL = 'https://srilatha.art'

export const SOCIAL = {
  instagram: 'https://instagram.com/srilatha.art',
  facebook: 'https://facebook.com/srilatha.art',
  pinterest: 'https://pinterest.com/srilatha_art',
  youtube: 'https://youtube.com/@srilatha_art',
} as const

export const INSTAGRAM_HANDLE = '@srilatha.art'

/** Build a wa.me link with an optional prefilled message. */
export function whatsappLink(message?: string): string {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}

/** Build a mailto: link with optional subject + body. */
export function emailLink(subject?: string, body?: string): string {
  const params = new URLSearchParams()
  if (subject) params.set('subject', subject)
  if (body) params.set('body', body)
  const qs = params.toString()
  return `mailto:${STUDIO_EMAIL}${qs ? '?' + qs : ''}`
}
