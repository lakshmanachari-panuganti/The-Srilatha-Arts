import { BlobServiceClient } from '@azure/storage-blob'
import { DefaultAzureCredential } from '@azure/identity'
import sharp from 'sharp'
import { v4 as uuidv4 } from 'uuid'

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME!
const blobBaseUrl = process.env.BLOB_BASE_URL!
const credential = new DefaultAzureCredential()

const blobServiceClient = new BlobServiceClient(
  `https://${accountName}.blob.core.windows.net`,
  credential
)

interface UploadResult {
  url: string
  thumbnailUrl: string
  fileName: string
  size: number
}

interface ProductImageOptions {
  /**
   * Optional title to derive an SEO-friendly filename from. When provided,
   * the blob is written to `{category}/{slug-from-title}-{YYYYMMDD}.webp`
   * (with a numeric suffix on collision). When omitted, a random
   * 8-character UUID is used - the legacy behaviour.
   */
  seoTitle?: string
}

// Slug-ify the AI-generated title for use as a filename.
//   - lowercase
//   - strip accents
//   - keep [a-z0-9]; collapse everything else to a single hyphen
//   - cap at 80 chars so the final `{slug}-YYYYMMDD.webp` stays well under
//     filesystem / URL length limits
export function buildSeoSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '') // trim trailing hyphen left after slice
  return slug
}

// UTC date in YYYYMMDD - appended to the SEO slug so an admin can spot
// when a particular image was published, and so a later upload of the
// "same" product on a different day naturally gets a different filename.
function todayYYYYMMDD(): string {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

// Find an unused `{base}.webp` (and reserve the matching thumb name).
// Tries the unsuffixed name first, then `-2`, `-3`, ... up to a safety
// ceiling. The ceiling exists only to avoid an infinite loop on a
// pathological storage account - in practice we'd never get past 2 or 3.
async function findUniqueProductBlobName(
  container: ReturnType<BlobServiceClient['getContainerClient']>,
  category: string,
  base: string,
): Promise<{ fileName: string; thumbFileName: string }> {
  const maxAttempts = 50
  for (let i = 1; i <= maxAttempts; i++) {
    const suffix = i === 1 ? '' : `-${i}`
    const fileName = `${category}/${base}${suffix}.webp`
    const thumbFileName = `${category}/${base}${suffix}-thumb.webp`
    const fullExists = await container.getBlockBlobClient(fileName).exists()
    const thumbExists = await container.getBlockBlobClient(thumbFileName).exists()
    if (!fullExists && !thumbExists) {
      return { fileName, thumbFileName }
    }
  }
  // Highly unlikely - fall through to a uuid-suffixed name so we never
  // silently overwrite an existing blob.
  const id = uuidv4().slice(0, 8)
  return {
    fileName: `${category}/${base}-${id}.webp`,
    thumbFileName: `${category}/${base}-${id}-thumb.webp`,
  }
}

export async function uploadProductImage(
  imageBuffer: Buffer,
  category: string,
  originalName: string,
  options: ProductImageOptions = {},
): Promise<UploadResult> {
  const containerClient = blobServiceClient.getContainerClient('products')

  let fileName: string
  let thumbFileName: string
  const slug = options.seoTitle ? buildSeoSlug(options.seoTitle) : ''
  if (slug) {
    // SEO path: `{category}/{slug}-{YYYYMMDD}.webp` with collision suffix.
    const base = `${slug}-${todayYYYYMMDD()}`
    const names = await findUniqueProductBlobName(containerClient, category, base)
    fileName = names.fileName
    thumbFileName = names.thumbFileName
  } else {
    // Legacy path: random uuid - kept for uploads without a known title
    // (e.g. ad-hoc admin uploads where AI generation hasn't been run).
    const id = uuidv4().slice(0, 8)
    fileName = `${category}/${id}.webp`
    thumbFileName = `${category}/thumb-${id}.webp`
  }

  const fullImage = await sharp(imageBuffer)
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer()

  const thumbImage = await sharp(imageBuffer)
    .resize(400, 400, { fit: 'cover' })
    .webp({ quality: 75 })
    .toBuffer()

  const fullBlob = containerClient.getBlockBlobClient(fileName)
  await fullBlob.upload(fullImage, fullImage.length, {
    blobHTTPHeaders: {
      blobContentType: 'image/webp',
      blobCacheControl: 'public, max-age=31536000',
    },
  })

  const thumbBlob = containerClient.getBlockBlobClient(thumbFileName)
  await thumbBlob.upload(thumbImage, thumbImage.length, {
    blobHTTPHeaders: {
      blobContentType: 'image/webp',
      blobCacheControl: 'public, max-age=31536000',
    },
  })

  return {
    url: `${blobBaseUrl}/products/${fileName}`,
    thumbnailUrl: `${blobBaseUrl}/products/${thumbFileName}`,
    fileName,
    size: fullImage.length,
  }
}

export async function uploadCategoryImage(imageBuffer: Buffer, categoryName: string): Promise<string> {
  const containerClient = blobServiceClient.getContainerClient('categories')
  const fileName = `${categoryName}-cover.webp`

  const processed = await sharp(imageBuffer)
    .resize(1600, 900, { fit: 'cover' })
    .webp({ quality: 85 })
    .toBuffer()

  const blob = containerClient.getBlockBlobClient(fileName)
  await blob.upload(processed, processed.length, {
    blobHTTPHeaders: {
      blobContentType: 'image/webp',
      blobCacheControl: 'public, max-age=2592000',
    },
  })

  return `${blobBaseUrl}/categories/${fileName}`
}

export async function deleteBlob(containerName: string, blobName: string): Promise<void> {
  const containerClient = blobServiceClient.getContainerClient(containerName)
  const blob = containerClient.getBlockBlobClient(blobName)
  await blob.deleteIfExists()
}

/**
 * Download the invoice PDF for an order. Returns null if the blob
 * doesn't exist (so callers can decide to regenerate). Used by the
 * notifications queue consumer to attach the same PDF every channel
 * delivers.
 */
export async function downloadInvoicePdf(invoiceNumber: string): Promise<Buffer | null> {
  const container = process.env.INVOICE_CONTAINER || 'invoices'
  const containerClient = blobServiceClient.getContainerClient(container)
  const blob = containerClient.getBlockBlobClient(`${invoiceNumber}.pdf`)
  const exists = await blob.exists()
  if (!exists) return null
  const download = await blob.download()
  if (!download.readableStreamBody) return null
  const chunks: Buffer[] = []
  for await (const chunk of download.readableStreamBody as AsyncIterable<Buffer>) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

/**
 * Upload an invoice PDF to the `invoices` container (or the value of
 * INVOICE_CONTAINER) and return the direct blob URL. The branded
 * /invoices/{id}.pdf URL is constructed by orderNumber.invoiceUrlFor()
 * for customer-facing use; this function returns the underlying blob
 * URL for diagnostic / admin paths.
 *
 * Idempotent - re-uploading the same `{InvoiceNumber}.pdf` overwrites
 * the existing blob, which is the correct behaviour if an invoice is
 * regenerated (e.g. after a refund-amount correction).
 */
export async function uploadInvoicePdf(
  invoiceNumber: string,
  pdfBuffer: Buffer,
): Promise<string> {
  const container = process.env.INVOICE_CONTAINER || 'invoices'
  const containerClient = blobServiceClient.getContainerClient(container)
  const blobName = `${invoiceNumber}.pdf`
  const blob = containerClient.getBlockBlobClient(blobName)
  await blob.upload(pdfBuffer, pdfBuffer.length, {
    blobHTTPHeaders: {
      blobContentType: 'application/pdf',
      // No long cache - invoices can be regenerated. The SWA route in
      // front handles its own caching headers if needed.
      blobCacheControl: 'no-cache, max-age=0',
      blobContentDisposition: `inline; filename="invoice-${invoiceNumber}.pdf"`,
    },
  })
  return `${blobBaseUrl}/${container}/${blobName}`
}
