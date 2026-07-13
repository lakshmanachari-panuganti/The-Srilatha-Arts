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
  /** Responsive srcset lookup - key is the target rendered width, value is
   *  the CDN URL for that variant. Populated by uploadProductImage so
   *  <img srcset> / next/image sizes can pick the smallest variant that
   *  still covers the layout, cutting bytes on mobile. Audit M1. */
  variants?: {
    w400: string
    w800: string
    w1200: string
  }
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
//
// NOTE: this exists()-then-upload pair is inherently TOCTOU - two
// concurrent uploads can both see a name as free. The uploads themselves
// close that window: uploadProductImage PUTs with `ifNoneMatch: '*'`
// (create-only), so the loser gets a storage conflict/precondition failure
// instead of overwriting, and retries with the next suffix.
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
  const slug = options.seoTitle ? buildSeoSlug(options.seoTitle) : ''

  // Responsive variants - audit M1. Generate one image per breakpoint so
  // small screens don't ship the 1200px hero. Sharing the same input
  // buffer, three sharp calls run in parallel to keep upload latency low.
  // Buffers are computed once, OUTSIDE the naming/upload retry loop below.
  const [imageXL, imageLG, imageMD] = await Promise.all([
    sharp(imageBuffer)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer(),
    sharp(imageBuffer)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer(),
    sharp(imageBuffer)
      .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer(),
  ])

  // Thumb (square-crop) - used by cart, mini-cards, admin. Kept separate
  // from the responsive variants so its aspect ratio is different (cover
  // crop for grid tiles, inside for the responsive photo variants).
  const thumbImage = await sharp(imageBuffer)
    .resize(400, 400, { fit: 'cover' })
    .webp({ quality: 75 })
    .toBuffer()

  // Create-only upload options: `ifNoneMatch: '*'` makes each PUT fail
  // (BlobAlreadyExists / ConditionNotMet) instead of silently overwriting.
  // Closes the TOCTOU window in findUniqueProductBlobName - two concurrent
  // uploads that picked the same name produce one winner and one clean retry
  // with the next suffix, never an overwrite. A losing attempt may leave a
  // stray variant blob behind (its sibling PUTs can land before the
  // conflicting one fails); that's harmless - orphans are unreferenced and
  // the deletion path uses deleteIfExists throughout.
  const createOnly = {
    blobHTTPHeaders: { blobContentType: 'image/webp' as const, blobCacheControl: 'public, max-age=31536000' },
    conditions: { ifNoneMatch: '*' },
  }

  const NAME_CONFLICT_RETRIES = 3
  for (let attempt = 1; attempt <= NAME_CONFLICT_RETRIES; attempt++) {
    let fileName: string
    let thumbFileName: string
    if (slug) {
      // SEO path: `{category}/{slug}-{YYYYMMDD}.webp` with collision suffix.
      // Re-run per attempt: after a 409 the winner's blobs now exist, so
      // this naturally picks the next free suffix.
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

    const dotIdx = fileName.lastIndexOf('.')
    const base = dotIdx >= 0 ? fileName.slice(0, dotIdx) : fileName
    const ext = dotIdx >= 0 ? fileName.slice(dotIdx) : '.webp'
    const nameXL = fileName                       // preserve historical URL
    const nameLG = `${base}-w800${ext}`
    const nameMD = `${base}-w400${ext}`

    try {
      // All uploads in parallel - 4 blob PUTs, ~equal cost.
      await Promise.all([
        containerClient.getBlockBlobClient(nameXL).upload(imageXL, imageXL.length, createOnly),
        containerClient.getBlockBlobClient(nameLG).upload(imageLG, imageLG.length, createOnly),
        containerClient.getBlockBlobClient(nameMD).upload(imageMD, imageMD.length, createOnly),
        containerClient.getBlockBlobClient(thumbFileName).upload(thumbImage, thumbImage.length, createOnly),
      ])
    } catch (err) {
      const storageErr = err as { statusCode?: number; code?: string }
      const nameConflict =
        storageErr.statusCode === 409 ||
        storageErr.statusCode === 412 ||
        storageErr.code === 'BlobAlreadyExists' ||
        storageErr.code === 'ConditionNotMet'
      if (nameConflict && attempt < NAME_CONFLICT_RETRIES) continue
      throw err
    }

    return {
      url: `${blobBaseUrl}/products/${fileName}`,
      thumbnailUrl: `${blobBaseUrl}/products/${thumbFileName}`,
      fileName,
      size: imageXL.length,
      variants: {
        w400: `${blobBaseUrl}/products/${nameMD}`,
        w800: `${blobBaseUrl}/products/${nameLG}`,
        w1200: `${blobBaseUrl}/products/${nameXL}`,
      },
    }
  }
  // Unreachable - the loop either returns or throws - but keeps tsc happy.
  throw new Error('uploadProductImage: exhausted name-conflict retries')
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

// Parse a product image URL back into (container, blobName). Only matches
// URLs that point at our storage account (either via BLOB_BASE_URL - which
// may be a CDN host - or directly at the blob endpoint). An external URL
// returns null so the caller silently skips it instead of guessing.
function parseOwnedBlobUrl(url: string): { container: string; blobName: string } | null {
  const prefixes = [blobBaseUrl, `https://${accountName}.blob.core.windows.net`]
  for (const prefix of prefixes) {
    if (!prefix) continue
    if (url.startsWith(prefix + '/')) {
      const rest = url.slice(prefix.length + 1)
      const slash = rest.indexOf('/')
      if (slash <= 0) return null
      return { container: rest.slice(0, slash), blobName: rest.slice(slash + 1) }
    }
  }
  return null
}

// Given the full-image blob name, return the candidate thumb names for
// both naming schemes used by uploadProductImage:
//   - SEO:    `{dir}{base}.webp`     →  `{dir}{base}-thumb.webp`
//   - legacy: `{dir}{id}.webp`       →  `{dir}thumb-{id}.webp`
// We can't tell from the name alone which scheme produced it, so we try
// both with deleteIfExists.
function productThumbCandidates(blobName: string): string[] {
  const lastSlash = blobName.lastIndexOf('/')
  const dir = lastSlash >= 0 ? blobName.slice(0, lastSlash + 1) : ''
  const file = blobName.slice(lastSlash + 1)
  const dotIdx = file.lastIndexOf('.')
  const base = dotIdx >= 0 ? file.slice(0, dotIdx) : file
  const ext = dotIdx >= 0 ? file.slice(dotIdx) : '.webp'
  return [`${dir}${base}-thumb${ext}`, `${dir}thumb-${base}${ext}`]
}

// Responsive srcset siblings written by uploadProductImage alongside the
// primary. Kept in lockstep with the deletion path so `-w400`/`-w800`
// blobs don't outlive the product row that referenced them.
function productVariantCandidates(blobName: string): string[] {
  const dotIdx = blobName.lastIndexOf('.')
  if (dotIdx < 0) return []
  const base = blobName.slice(0, dotIdx)
  const ext = blobName.slice(dotIdx)
  return [`${base}-w400${ext}`, `${base}-w800${ext}`]
}

/**
 * Delete a product image (full + thumb + responsive variants) given its
 * public URL. No-ops on URLs that don't belong to our storage account.
 * deleteIfExists means a missing blob is not an error - useful since we
 * always try both thumb naming schemes and only one will hit.
 */
export async function deleteProductImageByUrl(url: string): Promise<void> {
  const parsed = parseOwnedBlobUrl(url)
  if (!parsed) return
  const { container, blobName } = parsed
  const containerClient = blobServiceClient.getContainerClient(container)
  const companions = [
    ...productThumbCandidates(blobName),
    ...productVariantCandidates(blobName),
  ]
  await containerClient.getBlockBlobClient(blobName).deleteIfExists()
  for (const companion of companions) {
    await containerClient.getBlockBlobClient(companion).deleteIfExists()
  }
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
