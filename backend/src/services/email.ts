/**
 * Transactional email transport (Gmail SMTP via nodemailer).
 *
 * Reads SMTP_* env vars and lazy-builds a singleton transporter so the
 * TLS handshake amortises across warm-function invocations.
 *
 * The actual retry-on-failure loop lives in the queue trigger
 * (functions/notificationsQueue) so a 5xx from Gmail surfaces back to
 * the queue and gets a fresh dequeue with exponential backoff. This
 * module exposes a single sendEmail() that either succeeds or throws.
 */

import nodemailer, { Transporter } from 'nodemailer'
import { CONTACT } from '../config/contact'

interface SendEmailInput {
  to: string
  subject: string
  html: string
  text: string
  attachments?: Array<{
    filename: string
    content: Buffer
    contentType?: string
  }>
  replyTo?: string
  /** Additional addresses to CC. Used by the dispatcher to copy the studio
   *  on every customer-facing transactional email so the studio has a
   *  complete audit trail of what the customer received. The studio CC
   *  list itself is centralised via STUDIO_NOTIFICATION_CC (the dispatcher
   *  reads the registry, decides whether to include the studio, and passes
   *  the resulting array here). Address transport stays a pure pipe. */
  cc?: string[]
}

interface SendEmailResult {
  messageId: string
}

let _transporter: Transporter | null = null

function getTransporter(): Transporter {
  if (_transporter) return _transporter
  const host = process.env.SMTP_HOST || 'smtp.gmail.com'
  const port = Number(process.env.SMTP_PORT || 587)
  // Gmail on 587 uses STARTTLS (secure:false + requireTLS:true). On 465
  // it's implicit TLS (secure:true). Toggleable via SMTP_SECURE for
  // future providers that flip the rule.
  const secure = String(process.env.SMTP_SECURE ?? '').toLowerCase() === 'true' || port === 465
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!user || !pass) {
    throw new Error('SMTP_USER and SMTP_PASS must be set to send email')
  }
  _transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    // Gmail rejects connections that don't set a TLS minimum.
    requireTLS: !secure,
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
  })
  return _transporter
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS)
}

export async function sendEmail(opts: SendEmailInput): Promise<SendEmailResult> {
  const transporter = getTransporter()
  const senderName = process.env.SMTP_SENDER_NAME || 'Srilatha Art'
  const senderEmail =
    process.env.SMTP_SENDER_EMAIL || process.env.SMTP_USER || CONTACT.email
  const replyTo =
    opts.replyTo || process.env.SMTP_REPLY_TO || CONTACT.email

  // De-dupe CC against the primary `to` so the studio (or any duplicate)
  // doesn't receive two copies of the same message.
  const ccUnique = (opts.cc || [])
    .map((c) => c.trim())
    .filter((c) => c.length > 0 && c.toLowerCase() !== opts.to.toLowerCase())
  const cc = Array.from(new Set(ccUnique.map((c) => c.toLowerCase()))).length
    ? Array.from(new Set(ccUnique))
    : undefined

  const info = await transporter.sendMail({
    from: { name: senderName, address: senderEmail },
    to: opts.to,
    cc,
    replyTo,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    attachments: opts.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType || 'application/octet-stream',
    })),
  })

  if (!info.messageId) {
    throw new Error('SMTP send returned no messageId')
  }
  return { messageId: info.messageId }
}
