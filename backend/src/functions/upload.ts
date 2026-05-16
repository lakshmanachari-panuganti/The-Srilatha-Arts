/**
 * Image Upload Endpoints (§8.4).
 *
 * POST /api/admin/upload          — admin product images (existing)
 * POST /api/upload/customer       — customer issue/custom-order photos
 * POST /api/upload/review         — review photos (post-delivery)
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { uploadProductImage } from '../services/blobStorage'
import { requireAdmin } from '../middleware/adminGuard'
import { requireUser } from '../middleware/userGuard'
import { enforceCsrf } from '../middleware/csrfGuard'
import { jsonResponse, errorResponse, corsPreflightResponse } from '../utils/response'
import { BlobServiceClient } from '@azure/storage-blob'
import { DefaultAzureCredential } from '@azure/identity'
import { randomUUID } from 'crypto'
import sharp from 'sharp'

const MAX_CUSTOMER_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

// Magic-byte signatures used to verify an uploaded file is actually an image.
// Filename extensions are user-controlled and not trusted.
function detectImageMime(buf: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buf.length < 12) return null
  // JPEG  FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  // PNG   89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return 'image/png'
  // WEBP  RIFF....WEBP
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return 'image/webp'
  return null
}

// Reused Azure clients — avoid re-creating per request and avoid runtime require().
const customerBlobService = (() => {
  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME
  if (!accountName) return null
  return new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net`,
    new DefaultAzureCredential(),
  )
})()

async function parseMultipartFile(request: HttpRequest): Promise<{ buffer: Buffer; name: string } | null> {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return null
    const arrayBuffer = await file.arrayBuffer()
    return { buffer: Buffer.from(arrayBuffer), name: file.name }
  } catch {
    return null
  }
}

// POST /api/admin/upload
async function adminUpload(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)
  const csrfFail = enforceCsrf(request, origin)
  if (csrfFail) return csrfFail
  const admin = requireAdmin(request)
  if (!admin) return errorResponse('Unauthorized', 401, origin)

  try {
    const category = request.query.get('category') || 'general'
    const file = await parseMultipartFile(request)
    if (!file) return errorResponse('No file provided', 400, origin)
    if (!detectImageMime(file.buffer)) {
      return errorResponse('File must be a JPEG, PNG, or WEBP image', 400, origin)
    }

    const result = await uploadProductImage(file.buffer, category, file.name)
    return jsonResponse({ image: result }, 201, {}, origin)
  } catch (err) {
    context.error('adminUpload failed', err)
    return errorResponse('Upload failed', 500, origin)
  }
}

// POST /api/upload/customer
async function customerUpload(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)
  const csrfFail = enforceCsrf(request, origin)
  if (csrfFail) return csrfFail
  const user = requireUser(request)
  if (!user) return errorResponse('Authentication required', 401, origin)

  try {
    if (!customerBlobService) {
      context.error('customerUpload: AZURE_STORAGE_ACCOUNT_NAME is not configured')
      return errorResponse('Upload service is not available', 503, origin)
    }

    const file = await parseMultipartFile(request)
    if (!file) return errorResponse('No file provided', 400, origin)
    if (file.buffer.length > MAX_CUSTOMER_FILE_SIZE) {
      return errorResponse('File too large (max 5 MB)', 400, origin)
    }

    const detectedMime = detectImageMime(file.buffer)
    if (!detectedMime) {
      return errorResponse('File must be a JPEG, PNG, or WEBP image', 400, origin)
    }

    // Re-encode to webp via sharp. This strips embedded metadata/scripts and
    // guarantees the uploaded bytes are a real, well-formed image.
    const reEncoded = await sharp(file.buffer)
      .rotate()
      .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer()

    // userId comes from a verified JWT so it's a safe path segment. We also
    // sanitise it just in case (only allow lowercase, digits, dot, dash, @).
    const safeUserSeg = user.userId.replace(/[^a-z0-9.@-]/gi, '_').slice(0, 80)
    const blobName = `${safeUserSeg}/${randomUUID()}.webp`

    const container = customerBlobService.getContainerClient(
      process.env.USER_UPLOAD_CONTAINER || 'user-uploads',
    )
    const blob = container.getBlockBlobClient(blobName)
    await blob.upload(reEncoded, reEncoded.length, {
      blobHTTPHeaders: {
        blobContentType: 'image/webp',
        blobCacheControl: 'public, max-age=31536000',
        // Force download disposition prevents inline rendering surprises
        // for any non-image bytes that somehow slip through.
        blobContentDisposition: 'inline',
      },
    })

    const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME!
    const url = `https://${accountName}.blob.core.windows.net/${container.containerName}/${blobName}`
    return jsonResponse({ url }, 201, {}, origin)
  } catch (err) {
    context.error('customerUpload failed', err)
    return errorResponse('Upload failed', 500, origin)
  }
}

app.http('adminUpload', { methods: ['POST', 'OPTIONS'], route: 'api/admin/upload', authLevel: 'anonymous', handler: adminUpload })
app.http('customerUpload', { methods: ['POST', 'OPTIONS'], route: 'api/upload/customer', authLevel: 'anonymous', handler: customerUpload })
