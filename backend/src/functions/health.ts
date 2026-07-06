/**
 * GET /api/health
 *
 * Liveness + dependency readiness probe. Returns 200 with a structured body
 * describing the state of the dependencies the rest of the API relies on.
 *
 * Designed for two readers:
 *   1. Azure Application Insights Availability Tests (the alert path) -
 *      a single GET every few minutes, expecting HTTP 200 + JSON.
 *   2. Humans + ops scripts (manual diagnosis) - JSON body explains *which*
 *      dependency failed when something is yellow.
 *
 * Probes:
 *   - storage: tries a tiny listAll on the products table (RBAC + connectivity)
 *   - razorpay: read-only env-var presence + key-id format check (no upstream call)
 *   - whatsapp: env-var presence (no upstream call)
 *   - email: env-var presence (no upstream call)
 *
 * Anonymous endpoint. CORS handled via the standard helpers.
 *
 * Status semantics:
 *   "ok"    - every probe passed
 *   "warn"  - non-critical dependency missing (e.g. WhatsApp env unset on dev)
 *   "fail"  - a critical probe failed; HTTP 503 returned
 *
 * Storage is the only critical dependency - without it nothing else works.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { TableServiceClient } from '@azure/data-tables'
import { DefaultAzureCredential } from '@azure/identity'
import { jsonResponse, corsPreflightResponse } from '../utils/response'

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME

interface ProbeResult {
  name: string
  ok: boolean
  detail?: string
  latencyMs?: number
}

async function probeStorage(): Promise<ProbeResult> {
  const t0 = Date.now()
  if (!accountName) {
    return { name: 'storage', ok: false, detail: 'AZURE_STORAGE_ACCOUNT_NAME unset' }
  }
  try {
    // List tables - cheap, exercises the same auth path everything else uses.
    const credential = new DefaultAzureCredential()
    const svc = new TableServiceClient(
      `https://${accountName}.table.core.windows.net`,
      credential,
    )
    const iter = svc.listTables({ queryOptions: { top: 1 } as never })
    // Consume one page (or empty); we only care that the call succeeds.
    await iter.next()
    return { name: 'storage', ok: true, latencyMs: Date.now() - t0 }
  } catch (err) {
    return {
      name: 'storage',
      ok: false,
      detail: err instanceof Error ? err.message : 'unknown',
      latencyMs: Date.now() - t0,
    }
  }
}

function probeRazorpay(): ProbeResult {
  const id = process.env.RAZORPAY_KEY_ID
  const secret = process.env.RAZORPAY_KEY_SECRET
  const webhook = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!id || !secret || !webhook) {
    return {
      name: 'razorpay',
      ok: false,
      detail: 'one or more RAZORPAY_* env vars unset',
    }
  }
  // Razorpay key IDs are `rzp_test_XXX` or `rzp_live_XXX` - flag obvious shape errors.
  if (!/^rzp_(test|live)_[A-Za-z0-9]+$/.test(id)) {
    return { name: 'razorpay', ok: false, detail: 'RAZORPAY_KEY_ID shape unexpected' }
  }
  return { name: 'razorpay', ok: true }
}

function probeWhatsApp(): ProbeResult {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  const ok = Boolean(phoneId && token)
  return {
    name: 'whatsapp',
    ok,
    detail: ok ? undefined : 'WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN unset',
  }
}

function probeEmail(): ProbeResult {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const ok = Boolean(host && user)
  return {
    name: 'email',
    ok,
    detail: ok ? undefined : 'SMTP_HOST or SMTP_USER unset',
  }
}

async function health(
  request: HttpRequest,
  _context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  const [storage, razorpay, whatsapp, email] = await Promise.all([
    probeStorage(),
    Promise.resolve(probeRazorpay()),
    Promise.resolve(probeWhatsApp()),
    Promise.resolve(probeEmail()),
  ])

  const probes = [storage, razorpay, whatsapp, email]

  // Storage is the only critical dependency. The rest are "warn" when unset
  // (deliberate for dev / partial-configuration environments).
  const status = !storage.ok
    ? 'fail'
    : probes.some((p) => !p.ok)
    ? 'warn'
    : 'ok'

  const httpStatus = status === 'fail' ? 503 : 200

  return jsonResponse(
    {
      status,
      version: process.env.WEBSITE_BUILD_ID || process.env.GITHUB_SHA || 'dev',
      timestamp: new Date().toISOString(),
      probes,
    },
    httpStatus,
    { 'Cache-Control': 'no-store' },
    origin,
  )
}

app.http('health', {
  methods: ['GET', 'OPTIONS'],
  route: 'api/health',
  authLevel: 'anonymous',
  handler: health,
})
