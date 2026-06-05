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
 * Public path note: order IDs are timestamps (YYYYMMDDHHMMSSFF) which
 * are somewhat guessable. The WhatsApp Cloud API needs to fetch the
 * URL from its own network to attach the PDF, so the URL has to be
 * reachable without authentication. We accept the casual-scraping
 * risk; a future hardening pass can add an HMAC token to the URL.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { BlobServiceClient } from '@azure/storage-blob'
import { DefaultAzureCredential } from '@azure/identity'

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
  const raw = request.params.file || ''
  // Strip the .pdf suffix if present so callers can use either path.
  // Also strip a leading slash if the wildcard happened to include it.
  const name = raw.replace(/^\/+/, '').replace(/\.pdf$/i, '')

  // Defence: only YYYYMMDDHHMMSSFF-shaped IDs (16 digits) or the
  // earlier 14-digit YYYYMMDDHHMMSS variant. Bare alphanumeric pattern
  // keeps the route compatible with the legacy TSA-YYYY-HEX format
  // (for orders that pre-date the migration) and any future ID scheme.
  if (!/^[A-Za-z0-9_-]{4,32}$/.test(name)) {
    return { status: 400, body: 'Invalid invoice id' }
  }

  const container = process.env.INVOICE_CONTAINER || 'invoices'
  const containerClient = blobServiceClient.getContainerClient(container)
  const blob = containerClient.getBlockBlobClient(`${name}.pdf`)

  try {
    const exists = await blob.exists()
    if (!exists) {
      return { status: 404, body: 'Invoice not found' }
    }
    const download = await blob.download()
    if (!download.readableStreamBody) {
      return { status: 500, body: 'Empty blob stream' }
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
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="invoice-${name}.pdf"`,
        'Cache-Control': 'private, max-age=300',
      },
      body,
    }
  } catch (err) {
    context.error('downloadInvoice failed', err)
    return { status: 500, body: 'Failed to load invoice' }
  }
}

app.http('downloadInvoice', {
  methods: ['GET'],
  route: 'api/invoices/{*file}',
  authLevel: 'anonymous',
  handler: downloadInvoice,
})
