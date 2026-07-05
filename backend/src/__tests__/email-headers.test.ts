/**
 * Regression tests for C3 header-injection defence.
 *
 * We can't easily unit-test the whole sendEmail path (it requires a live
 * SMTP transport), so we assert the private CRLF-stripping helper's shape
 * by exercising it through the smallest testable surface: monkey-patching
 * nodemailer's createTransport to capture the sendMail payload.
 */

import { jest } from '@jest/globals'

// Capture the args each call passed to sendMail.
const sent: Array<Record<string, unknown>> = []

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: () => ({
      sendMail: async (msg: Record<string, unknown>) => {
        sent.push(msg)
        return { messageId: '<mock>' }
      },
    }),
  },
}))

// Force the required env vars BEFORE importing the module under test.
process.env.SMTP_USER = 'user@example.com'
process.env.SMTP_PASS = 'password'

/* eslint-disable @typescript-eslint/no-require-imports */
const { sendEmail } = require('../services/email') as {
  sendEmail: (opts: {
    to: string
    subject: string
    html: string
    text: string
    replyTo?: string
  }) => Promise<{ messageId: string }>
}
/* eslint-enable */

describe('sendEmail - CRLF header injection defence', () => {
  beforeEach(() => {
    sent.length = 0
  })

  it('strips \\r\\n from subject', async () => {
    await sendEmail({
      to: 'a@b.c',
      subject: 'Order 123\r\nBcc: attacker@evil.com',
      html: '<p>hi</p>',
      text: 'hi',
    })
    const msg = sent[0]
    // The injected CRLF is gone — SMTP can no longer be tricked into
    // reading "Bcc: …" as a new header. The literal substring "Bcc:"
    // may remain in the subject text; that's harmless once CRLF is gone.
    expect(String(msg.subject)).not.toMatch(/[\r\n]/)
  })

  it('strips \\r\\n from the recipient address', async () => {
    await sendEmail({
      to: 'a@b.c\r\nBcc: attacker@evil.com',
      subject: 'Hello',
      html: '<p>hi</p>',
      text: 'hi',
    })
    expect(String(sent[0].to)).not.toMatch(/[\r\n]/)
  })

  it('strips \\r\\n from replyTo', async () => {
    await sendEmail({
      to: 'a@b.c',
      replyTo: 'r@x.c\r\nX-Header: pwn',
      subject: 'Hello',
      html: '<p>hi</p>',
      text: 'hi',
    })
    expect(String(sent[0].replyTo)).not.toMatch(/[\r\n]/)
  })
})
