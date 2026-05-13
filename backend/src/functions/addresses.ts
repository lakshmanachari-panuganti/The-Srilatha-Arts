/**
 * Address Book Endpoints (§4.2).
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import {
  getAddresses, getAddress, upsertAddress, deleteAddress, clearDefaultAddress, Row,
} from '../services/tableStorage'
import { requireUser } from '../middleware/userGuard'
import { jsonResponse, errorResponse, corsPreflightResponse, noContent } from '../utils/response'
import { randomUUID } from 'crypto'

function toApi(row: Row) {
  return {
    id: row.rowKey, label: row.label || 'Home', fullName: row.fullName,
    phone: row.phone, line1: row.line1, line2: row.line2 || undefined,
    city: row.city, state: row.state, pincode: row.pincode,
    isDefault: row.isDefault === true, createdAt: row.createdAt,
  }
}

async function addressesHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)
  const user = requireUser(request)
  if (!user) return errorResponse('Authentication required', 401, origin)

  try {
    if (request.method === 'GET') {
      const addresses = await getAddresses(user.userId)
      return jsonResponse({ addresses: addresses.map(toApi) }, 200, {}, origin)
    }
    if (request.method === 'POST') {
      const body = (await request.json()) as Record<string, any>
      if (!body.fullName || !body.phone || !body.line1 || !body.city || !body.state || !body.pincode) {
        return errorResponse('All address fields are required', 400, origin)
      }
      const addressId = randomUUID().slice(0, 12)
      const now = new Date().toISOString()
      if (body.isDefault) await clearDefaultAddress(user.userId)
      const row: Row = {
        partitionKey: user.userId, rowKey: addressId, label: body.label || 'Home',
        fullName: body.fullName, phone: body.phone, line1: body.line1,
        line2: body.line2 || '', city: body.city, state: body.state,
        pincode: body.pincode, isDefault: body.isDefault === true,
        createdAt: now, updatedAt: now,
      }
      await upsertAddress(row)
      return jsonResponse({ address: toApi(row) }, 201, {}, origin)
    }
    return errorResponse('Method not allowed', 405, origin)
  } catch (err) {
    context.error('addressesHandler failed', err)
    return errorResponse('Failed to process address', 500, origin)
  }
}

async function addressById(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)
  const user = requireUser(request)
  if (!user) return errorResponse('Authentication required', 401, origin)
  const addressId = request.params.id
  if (!addressId) return errorResponse('Missing address id', 400, origin)

  try {
    if (request.method === 'PATCH') {
      const existing = await getAddress(user.userId, addressId)
      if (!existing) return errorResponse('Address not found', 404, origin)
      const body = (await request.json()) as Record<string, unknown>
      if (body.isDefault === true) await clearDefaultAddress(user.userId, addressId)
      const updated: Row = { ...existing, ...body, partitionKey: user.userId, rowKey: addressId, updatedAt: new Date().toISOString() }
      await upsertAddress(updated)
      return jsonResponse({ address: toApi(updated) }, 200, {}, origin)
    }
    if (request.method === 'DELETE') {
      await deleteAddress(user.userId, addressId)
      return noContent(origin)
    }
    return errorResponse('Method not allowed', 405, origin)
  } catch (err) {
    context.error('addressById failed', err)
    return errorResponse('Failed to process address', 500, origin)
  }
}

app.http('addresses', { methods: ['GET', 'POST', 'OPTIONS'], route: 'api/addresses', authLevel: 'anonymous', handler: addressesHandler })
app.http('addressById', { methods: ['PATCH', 'DELETE', 'OPTIONS'], route: 'api/addresses/{id}', authLevel: 'anonymous', handler: addressById })
