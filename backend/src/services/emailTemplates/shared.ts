/**
 * Shared email-template utilities — colors, escapers, formatters, and the
 * branded HTML shell used by every transactional template that doesn't
 * carry a full invoice (orderConfirmation.ts has its own layout because
 * it renders a line-item table and the invoice PDF preview).
 *
 * Visual identity matches frontend/app/globals.css :root tokens so the
 * inbox + the /account/invoices page + the attached PDF read as one
 * artefact.
 *
 * Template-author contract:
 *
 *   buildEmail({
 *     preheader: '...',          // hidden preview-pane teaser
 *     heading: '...',            // big serif headline
 *     introHtml: '...',          // 1-2 short paragraphs after the heading
 *     detailRows: [              // optional key-value pairs
 *       { label: 'Order', value: '202606140915XXXX' },
 *       { label: 'Tracking', value: 'DTDC-9912-AB' },
 *     ],
 *     cta?: { label, href },     // optional single CTA button
 *     footerHtml: '...',         // closing paragraph (warm sign-off, contacts)
 *   }) → { subject, html, text }
 *
 * Every template stays a thin function that fills in this shape.
 */

export interface BuiltEmail {
  subject: string
  html: string
  text: string
}

export interface DetailRow {
  label: string
  value: string
}

export interface EmailLayoutInput {
  subject: string
  preheader: string
  heading: string
  introHtml: string
  detailRows?: DetailRow[]
  cta?: { label: string; href: string }
  footerHtml: string
}

// ── Brand palette ─────────────────────────────────────────────────
// Keep aligned with frontend/app/globals.css :root tokens. Inline only —
// no external CSS, no <style> blocks in <head> (Gmail strips them).
export const COLOR = {
  ink: '#221b12',
  inkSoft: '#43392e',
  inkMute: '#8a7e6e',
  rule: '#e1dbcf',
  gold: '#b88a2d',
  goldDeep: '#8a6a1a',
  paper: '#fdfcf8',
  paperDeep: '#f6f1e6',
}

export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function fmtMoneyRs(rs: number): string {
  return `₹ ${rs.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

export function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    })
  } catch {
    return iso
  }
}

/**
 * Render the branded HTML shell around per-template body content.
 *
 * Layout is a max-600px centred table with: hidden preheader for the
 * inbox preview pane, an ivory header card with the wordmark, the
 * template's body block, optional detail rows, optional CTA button,
 * and a closing footer paragraph. All inline-styled — survives Gmail,
 * Outlook, Apple Mail, and the major mobile clients.
 */
export function renderEmail(input: EmailLayoutInput): BuiltEmail {
  const detailRowsHtml = (input.detailRows || [])
    .map(
      (r) => `
      <tr>
        <td style="padding:8px 0;color:${COLOR.inkMute};font-size:13px;letter-spacing:0.06em;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">${escapeHtml(r.label)}</td>
        <td style="padding:8px 0 8px 16px;color:${COLOR.ink};font-size:15px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">${escapeHtml(r.value)}</td>
      </tr>`,
    )
    .join('')

  const detailTableHtml = detailRowsHtml
    ? `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0 4px;border-top:1px solid ${COLOR.rule};">
      ${detailRowsHtml}
    </table>`
    : ''

  const ctaHtml = input.cta
    ? `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px;">
      <tr>
        <td style="border-radius:999px;background:${COLOR.ink};">
          <a href="${escapeHtml(input.cta.href)}" style="display:inline-block;padding:14px 28px;color:#ffffff;text-decoration:none;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-weight:600;">${escapeHtml(input.cta.label)}</a>
        </td>
      </tr>
    </table>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(input.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${COLOR.paperDeep};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:${COLOR.ink};">
  <!-- Preview-pane teaser; visually hidden but Gmail/Outlook show it -->
  <div style="display:none;font-size:1px;color:${COLOR.paperDeep};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(input.preheader)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${COLOR.paperDeep};">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background:${COLOR.paper};border:1px solid ${COLOR.rule};border-radius:12px;overflow:hidden;">
          <!-- Header strip with wordmark -->
          <tr>
            <td style="padding:24px 32px 12px;border-bottom:1px solid ${COLOR.rule};">
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:0.02em;color:${COLOR.ink};">Srilatha Art</p>
              <p style="margin:4px 0 0;font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:${COLOR.inkMute};">Handcrafted in Hyderabad</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:500;color:${COLOR.ink};line-height:1.3;">${escapeHtml(input.heading)}</h1>
              <div style="font-size:15px;line-height:1.65;color:${COLOR.inkSoft};">${input.introHtml}</div>
              ${detailTableHtml}
              ${ctaHtml}
              <div style="margin-top:24px;font-size:14px;line-height:1.65;color:${COLOR.inkSoft};">${input.footerHtml}</div>
            </td>
          </tr>
          <!-- Footer / colophon -->
          <tr>
            <td style="padding:20px 32px 24px;border-top:1px solid ${COLOR.rule};background:${COLOR.paperDeep};">
              <p style="margin:0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${COLOR.inkMute};text-align:center;">
                Srilatha Art · Hyderabad · studio@srilatha.art
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = renderPlainText(input)
  return { subject: input.subject, html, text }
}

function renderPlainText(input: EmailLayoutInput): string {
  const lines: string[] = []
  lines.push(input.heading)
  lines.push('')
  lines.push(stripTags(input.introHtml))
  if (input.detailRows && input.detailRows.length) {
    lines.push('')
    for (const r of input.detailRows) {
      lines.push(`${r.label}: ${r.value}`)
    }
  }
  if (input.cta) {
    lines.push('')
    lines.push(`${input.cta.label}: ${input.cta.href}`)
  }
  lines.push('')
  lines.push(stripTags(input.footerHtml))
  lines.push('')
  lines.push('—')
  lines.push('Srilatha Art · Hyderabad · studio@srilatha.art')
  return lines.join('\n')
}

function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>(\s*)/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
