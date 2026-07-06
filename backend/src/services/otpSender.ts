/**
 * Verification-OTP WhatsApp sender.
 *
 * Bypasses the notifications queue on purpose: OTPs are latency-sensitive
 * (users are staring at the form waiting for the code), non-idempotent
 * (a queue retry would send a second SMS/WhatsApp for the same code),
 * and belong to the auth channel — not the customer-transactional dual-
 * channel path that fires with a studio BCC.
 *
 * Uses the Meta template `verification_otp_v1`:
 *   Body: "{{1}} is your verification code."
 *
 * Callers own the OTP lifecycle (generation, storage, expiry, verify
 * endpoint, rate-limit). This module is a pure send primitive.
 */

import { sendTemplateMessage, isWhatsAppConfigured } from './whatsapp'

const OTP_TEMPLATE_NAME = 'verification_otp_v1'

export interface SendVerificationOtpResult {
  messageId: string
  toPhone: string
}

/**
 * Send `code` to `phone` via the verification_otp_v1 template.
 * Throws if WhatsApp is not configured or the Cloud API rejects the send —
 * callers should treat that as "OTP delivery failed" and surface a retry
 * option in the UI.
 */
export async function sendVerificationOtp(
  phone: string,
  code: string,
): Promise<SendVerificationOtpResult> {
  if (!isWhatsAppConfigured()) {
    throw new Error('WhatsApp Cloud API is not configured')
  }
  if (!phone) throw new Error('sendVerificationOtp: phone is required')
  if (!code) throw new Error('sendVerificationOtp: code is required')

  const result = await sendTemplateMessage({
    toPhone: phone,
    templateName: OTP_TEMPLATE_NAME,
    bodyVariables: [code],
  })
  return { messageId: result.messageId, toPhone: result.toPhone }
}
