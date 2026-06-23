/**
 * Centralised brand contact info — single source of truth for the studio's
 * phone, WhatsApp, email, Instagram, hours and postal address.
 *
 * Backend mirrors this shape at backend/src/config/contact.ts (the frontend
 * is statically exported and the backend ships as a separate Azure Functions
 * package, so they can't share a module without splitting into a workspace).
 * Keep the two files in sync.
 */

export const CONTACT = {
  // International format without '+'. The '91' prefix is required by wa.me.
  whatsappE164: '919052380325',
  whatsappDisplay: '+91 90523 80325',
  phoneDisplay: '+91 90523 80325',
  phoneTel: '+919052380325',

  email: 'studio@srilatha.art',

  studioAddress: {
    line1: 'Chilkanagar',
    line2: 'Uppal',
    city: 'Hyderabad',
    region: 'Telangana',
    country: 'India',
    countryCode: 'IN',
  },

  instagramHandle: 'srilatha.art',
  instagramHandleAt: '@srilatha.art',
  instagramUrl: 'https://instagram.com/srilatha.art',

  hours: 'Mon–Sat · 10am–7pm IST',

  websiteUrl: 'https://www.srilatha.art',

  social: {
    instagram: 'https://instagram.com/srilatha.art',
    facebook: 'https://facebook.com/srilatha.art',
    pinterest: 'https://pinterest.com/srilatha_art',
    youtube: 'https://youtube.com/@srilatha_art',
  },
} as const

/** Build a wa.me link with a prefilled message. */
export const waLink = (text: string): string =>
  `https://wa.me/${CONTACT.whatsappE164}?text=${encodeURIComponent(text)}`

/** Build a mailto: link with optional subject + body. */
export const mailtoLink = (subject?: string, body?: string): string => {
  const params = new URLSearchParams()
  if (subject) params.set('subject', subject)
  if (body) params.set('body', body)
  const qs = params.toString()
  return `mailto:${CONTACT.email}${qs ? '?' + qs : ''}`
}
