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
      const body = (await request.json()) as Record<string, unknown>

      const fullName = ((body.fullName || '') as string).trim()
      const phone    = ((body.phone    || '') as string).trim()
      const line1    = ((body.line1    || '') as string).trim()
      const line2    = ((body.line2    || '') as string).trim()
      const city     = ((body.city     || '') as string).trim()
      const state    = ((body.state    || '') as string).trim()
      const pincode  = ((body.pincode  || '') as string).trim()
      const label    = ((body.label    || 'Home') as string).trim()

      if (!fullName || !phone || !line1 || !city || !state || !pincode) {
        return errorResponse('All address fields are required', 400, origin)
      }
      if (fullName.length > 100) return errorResponse('Full name must be 100 characters or less', 400, origin)
      if (phone.length > 20)     return errorResponse('Phone must be 20 characters or less', 400, origin)
      if (line1.length > 200)    return errorResponse('Address line 1 must be 200 characters or less', 400, origin)
      if (line2.length > 200)    return errorResponse('Address line 2 must be 200 characters or less', 400, origin)
      if (city.length > 100)     return errorResponse('City must be 100 characters or less', 400, origin)
      if (state.length > 100)    return errorResponse('State must be 100 characters or less', 400, origin)
      if (label.length > 50)     return errorResponse('Label must be 50 characters or less', 400, origin)
      if (!/^\d{6}$/.test(pincode)) return errorResponse('Pincode must be exactly 6 digits', 400, origin)

      const addressId = randomUUID().slice(0, 12)
      const now = new Date().toISOString()
      if (body.isDefault) await clearDefaultAddress(user.userId)
      const row: Row = {
        partitionKey: user.userId, rowKey: addressId, label,
        fullName, phone, line1,
        line2, city, state,
        pincode, isDefault: body.isDefault === true,
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
