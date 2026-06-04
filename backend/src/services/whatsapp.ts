/**
 * WhatsApp Cloud API client.
 *
 * Reads credentials from the environment (set by the Azure Function App):
 *   WHATSAPP_ACCESS_TOKEN     - permanent system-user token
 *   WHATSAPP_PHONE_NUMBER_ID  - sender phone number id (the studio's WABA number)
 *   WHATSAPP_WABA_ID          - WhatsApp Business Account id (currently unused
 *                               but kept available for media-upload paths and
 *                               future template introspection)
 *
 * Configurable via env (with sensible defaults):
 *   WHATSAPP_API_VERSION       - default 'v18.0'
 *   WHATSAPP_TEMPLATE_LANGUAGE - default 'en' (matches what's typically
 *                                approved on Indian-market WABAs)
 *
 * Network failures throw - the caller decides whether to retry or
 * down-grade gracefully (we don't want a WhatsApp outage to look like
 * a payment failure to the customer).
 */

const WA_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v18.0'
const WA_TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en'

export function isWhatsAppConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID,
  )
}

/**
 * Normalise an Indian phone number to E.164 without the leading '+'
 * (Cloud API expects digits only). Accepts:
 *   "+91 91332 66754" → "919133266754"
 *   "9133266754"      → "919133266754"  (assumes IN if 10 digits)
 *   "919133266754"    → "919133266754"
 */
function normalisePhone(raw: string): string {
  const digits = (raw || '').replace(/\D+/g, '')
  if (digits.length === 10) return `91${digits}`
  return digits
}

interface TemplateComponent {
  type: 'header' | 'body' | 'button'
  parameters: Array<
    | { type: 'text'; text: string }
    | { type: 'document'; document: { link: string; filename?: string } }
  >
  sub_type?: 'url' | 'quick_reply'
  index?: string
}

interface SendTemplateOptions {
  toPhone: string
  templateName: string
  /** Body variables in the order they appear as {{1}}, {{2}}, ... */
  bodyVariables: string[]
  /** Optional DOCUMENT header (used to attach the invoice PDF). */
  documentHeader?: { link: string; filename: string }
  /** Optional language override - defaults to WHATSAPP_TEMPLATE_LANGUAGE. */
  languageCode?: string
}

interface SendTemplateResult {
  messageId: string
}

/**
 * Send a templated WhatsApp message via the Cloud API.
 * Throws on transport or API-level errors with a structured message
 * including the upstream description for debugging.
 */
export async function sendTemplateMessage(
  opts: SendTemplateOptions,
): Promise<SendTemplateResult> {
  if (!isWhatsAppConfigured()) {
    throw new Error('WhatsApp Cloud API is not configured (missing env vars)')
  }

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN!
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!
  const language = opts.languageCode || WA_TEMPLATE_LANG

  const components: TemplateComponent[] = []
  if (opts.documentHeader) {
    components.push({
      type: 'header',
      parameters: [
        {
          type: 'document',
          document: {
            link: opts.documentHeader.link,
            filename: opts.documentHeader.filename,
          },
        },
      ],
    })
  }
  if (opts.bodyVariables.length > 0) {
    components.push({
      type: 'body',
      parameters: opts.bodyVariables.map((v) => ({ type: 'text', text: v })),
    })
  }

  const url = `https://graph.facebook.com/${WA_API_VERSION}/${phoneNumberId}/messages`
  const payload = {
    messaging_product: 'whatsapp',
    to: normalisePhone(opts.toPhone),
    type: 'template',
    template: {
      name: opts.templateName,
      language: { code: language },
      ...(components.length > 0 ? { components } : {}),
    },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const text = await res.text()
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(
      `[whatsapp] non-JSON response (${res.status}): ${text.slice(0, 200)}`,
    )
  }

  if (!res.ok) {
    // The Cloud API error envelope looks like:
    //   { error: { message, type, code, error_subcode, fbtrace_id, error_data: { details } } }
    const err = (json as { error?: { message?: string; code?: number; error_subcode?: number } }).error
    const detail = err?.message || 'unknown error'
    const code = err?.code ?? res.status
    throw new Error(`[whatsapp] send failed (${code}): ${detail}`)
  }

  const messageId =
    (json as { messages?: Array<{ id?: string }> }).messages?.[0]?.id || ''
  if (!messageId) {
    throw new Error(`[whatsapp] no message id in response: ${text.slice(0, 200)}`)
  }
  return { messageId }
}
