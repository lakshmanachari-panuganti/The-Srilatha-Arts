/**
 * Customer-facing studio contact number, injected as {{Store Contact
 * Number}} into every *_v1 WhatsApp transactional template and shown in
 * email footers.
 *
 * Rotate without a code deploy by setting the STORE_CONTACT_NUMBER Function
 * App setting. The fallback is the current studio number as of 2026-07-05.
 */

const FALLBACK_STORE_CONTACT = '+91 9014393938'

export function getStoreContactNumber(): string {
  const raw = (process.env.STORE_CONTACT_NUMBER || '').trim()
  return raw || FALLBACK_STORE_CONTACT
}
