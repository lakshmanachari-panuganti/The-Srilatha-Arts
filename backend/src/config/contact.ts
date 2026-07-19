/**
 * Centralised studio contact info for the backend (invoice PDFs, email
 * templates, sender/reply-to fallbacks).
 *
 * This mirrors frontend/lib/site-config.ts. The two stay in sync manually
 * because the backend is a separate Azure Functions package and cannot
 * import from the frontend without splitting the repo into a workspace.
 * Keep this file's CONTACT shape identical to the frontend's.
 */

export const CONTACT = {
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
  websiteHost: 'www.srilatha.art',
} as const
