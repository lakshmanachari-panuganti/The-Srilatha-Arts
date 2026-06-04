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

export async function uploadProductImage(
  imageBuffer: Buffer,
  category: string,
  originalName: string
): Promise<UploadResult> {
  const containerClient = blobServiceClient.getContainerClient('products')

  const id = uuidv4().slice(0, 8)
  const fileName = `${category}/${id}.webp`
  const thumbFileName = `${category}/thumb-${id}.webp`

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
