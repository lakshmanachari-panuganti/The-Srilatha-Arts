/**
 * Image Upload Endpoints (§8.4).
 *
 * POST /api/admin/upload          — admin product images (existing)
 * POST /api/upload/customer       — customer issue/custom-order photos
 * POST /api/upload/review         — review photos (post-delivery)
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { uploadProductImage, uploadCategoryImage } from '../services/blobStorage'
import { requireAdmin } from '../middleware/adminGuard'
import { requireUser } from '../middleware/userGuard'
import { jsonResponse, errorResponse, corsPreflightResponse } from '../utils/response'

const MAX_CUSTOMER_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

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
  const admin = requireAdmin(request)
  if (!admin) return errorResponse('Unauthorized', 401, origin)

  try {
    const category = request.query.get('category') || 'general'
    const file = await parseMultipartFile(request)
    if (!file) return errorResponse('No file provided', 400, origin)

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
  const user = requireUser(request)
  if (!user) return errorResponse('Authentication required', 401, origin)

  try {
    const file = await parseMultipartFile(request)
    if (!file) return errorResponse('No file provided', 400, origin)
    if (file.buffer.length > MAX_CUSTOMER_FILE_SIZE) {
      return errorResponse('File too large (max 5 MB)', 400, origin)
    }

    const { BlobServiceClient } = require('@azure/storage-blob')
    const { DefaultAzureCredential } = require('@azure/identity')
    const { v4: uuidv4 } = require('uuid')

    const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME!
    const blobService = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      new DefaultAzureCredential(),
    )
    const container = blobService.getContainerClient(process.env.USER_UPLOAD_CONTAINER || 'user-uploads')
    const ext = file.name.split('.').pop() || 'jpg'
    const blobName = `${user.userId}/${uuidv4().slice(0, 8)}.${ext}`
    const blob = container.getBlockBlobClient(blobName)
    await blob.upload(file.buffer, file.buffer.length, {
      blobHTTPHeaders: { blobContentType: `image/${ext === 'png' ? 'png' : 'jpeg'}` },
    })

    const url = `https://${accountName}.blob.core.windows.net/${container.containerName}/${blobName}`
    return jsonResponse({ url }, 201, {}, origin)
  } catch (err) {
    context.error('customerUpload failed', err)
    return errorResponse('Upload failed', 500, origin)
  }
}

app.http('adminUpload', { methods: ['POST', 'OPTIONS'], route: 'api/admin/upload', authLevel: 'anonymous', handler: adminUpload })
app.http('customerUpload', { methods: ['POST', 'OPTIONS'], route: 'api/upload/customer', authLevel: 'anonymous', handler: customerUpload })
