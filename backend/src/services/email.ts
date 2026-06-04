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
    process.env.SMTP_SENDER_EMAIL || process.env.SMTP_USER || 'noreply@srilatha.art'
  const replyTo =
    opts.replyTo || process.env.SMTP_REPLY_TO || 'studio@srilatha.art'

  const info = await transporter.sendMail({
    from: { name: senderName, address: senderEmail },
    to: opts.to,
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
