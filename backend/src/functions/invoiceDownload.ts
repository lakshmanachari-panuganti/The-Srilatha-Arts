/**
 * GET /api/invoices/{file}
 *
 * Streams an invoice PDF from the `invoices` blob container with the
 * application/pdf content type. The branded customer-facing URL
 *
 *   https://www.srilatha.art/invoices/{InvoiceNumber}.pdf
 *
 * is rewritten by SWA (frontend/staticwebapp.config.json) to:
 *
 *   /api/invoices/{InvoiceNumber}.pdf
 *
 * which lands here. The blob container can stay private (DefaultAzure
 * Credential authenticates via the Function App's managed identity)
 * even though the customer URL is public - making this the simplest
 * way to honour the branded path without exposing raw blob URLs to
 * customers or shipping every invoice through SAS.
 *
 * Access control: order IDs are timestamps (YYYYMMDDHHMMSSFF) which are
 * guessable, so post-cutover invoices must carry an HMAC token in the
 * `?token=...` query string. The WhatsApp Cloud API fetches the URL
 * from its own network to attach the PDF - the token rides along in
 * the query string so the URL stays anonymously fetchable without
 * leaking PII via enumeration. Legacy IDs and invoices issued before
 * the cutover (see INVOICE_TOKEN_CUTOVER in services/orderNumber)
 * bypass the check so previously mailed/WhatsApp'd links keep working.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { BlobServiceClient } from '@azure/storage-blob'
import { DefaultAzureCredential } from '@azure/identity'
import { invoiceRequiresToken, verifyInvoiceToken } from '../services/orderNumber'
import { corsHeaders } from '../utils/response'

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME!
const credential = new DefaultAzureCredential()
const blobServiceClient = new BlobServiceClient(
  `https://${accountName}.blob.core.windows.net`,
  credential,
)

async function downloadInvoice(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  // CORS - the PDF is fetched cross-origin from the SWA front-end via the
  // INVOICE_PUBLIC_URL_BASE (Function App) URL because Free-tier SWA can't
  // proxy /api/* to a linked backend. Without these headers the browser
  // blocks the response and the user sees "Failed to fetch".
  const origin = request.headers.get('origin')
  const cors = corsHeaders(origin)

  if (request.method === 'OPTIONS') {
    return { status: 204, headers: cors }
  }

  const raw = request.params.file || ''
  // Strip the .pdf suffix if present so callers can use either path.
  // Also strip a leading slash if the wildcard happened to include it.
  const name = raw.replace(/^\/+/, '').replace(/\.pdf$/i, '')

  // Defence: only YYYYMMDDHHMMSSFF-shaped IDs (16 digits) or the
  // earlier 14-digit YYYYMMDDHHMMSS variant. Bare alphanumeric pattern
  // keeps the route compatible with the legacy TSA-YYYY-HEX format
  // (for orders that pre-date the migration) and any future ID scheme.
  if (!/^[A-Za-z0-9_-]{4,32}$/.test(name)) {
    return { status: 400, headers: cors, body: 'Invalid invoice id' }
  }

  // HMAC gate: post-cutover 16-digit IDs must carry a valid ?token=.
  // Legacy non-16-digit IDs and pre-cutover IDs are grandfathered.
  if (invoiceRequiresToken(name)) {
    const url = new URL(request.url)
    const token = url.searchParams.get('token')
    if (!verifyInvoiceToken(name, token)) {
      // 404 (not 401/403) so an attacker brute-forcing IDs cannot
      // distinguish "this ID exists but you don't have the token" from
      // "this ID does not exist" - same response in both cases.
      return { status: 404, headers: cors, body: 'Invoice not found' }
    }
  }

  const container = process.env.INVOICE_CONTAINER || 'invoices'
  const containerClient = blobServiceClient.getContainerClient(container)
  const blob = containerClient.getBlockBlobClient(`${name}.pdf`)

  try {
    const exists = await blob.exists()
    if (!exists) {
      return { status: 404, headers: cors, body: 'Invoice not found' }
    }
    const download = await blob.download()
    if (!download.readableStreamBody) {
      return { status: 500, headers: cors, body: 'Empty blob stream' }
    }
    // Buffer the response - Functions handles streaming via Buffer/string
    // body. Invoices are small (~50KB) so this is cheap and avoids
    // dragging in a node:stream → web ReadableStream adapter.
    const chunks: Buffer[] = []
    for await (const chunk of download.readableStreamBody as AsyncIterable<Buffer>) {
      chunks.push(chunk)
    }
    const body = Buffer.concat(chunks)

    return {
      status: 200,
      headers: {
        ...cors,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="invoice-${name}.pdf"`,
        'Cache-Control': 'private, max-age=300',
      },
      body,
    }
  } catch (err) {
    context.error('downloadInvoice failed', err)
    return { status: 500, headers: cors, body: 'Failed to load invoice' }
  }
}

app.http('downloadInvoice', {
  methods: ['GET', 'OPTIONS'],
  route: 'api/invoices/{*file}',
  authLevel: 'anonymous',
  handler: downloadInvoice,
})
