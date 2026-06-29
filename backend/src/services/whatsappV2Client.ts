/**
 * HTTP client for the WhatsApp v2 Function App.
 *
 * Acquires a token via the website backend's Managed Identity (which holds
 * the `Messages.Access.Srilatha` app role on v2's AAD app registration),
 * then calls v2's admin endpoints over HTTPS.
 *
 * Gracefully returns empty data when v2 is unreachable or misconfigured,
 * so the admin UI degrades to showing only local (outbound) messages
 * rather than erroring out entirely.
 */

import { DefaultAzureCredential } from '@azure/identity'

// ─── Configuration ───────────────────────────────────────────

const V2_BASE_URL = process.env.WHATSAPP_V2_API_BASE_URL || ''
const V2_AUDIENCE = process.env.WHATSAPP_V2_AUDIENCE || ''
const V2_FUNCTION_KEY = process.env.WHATSAPP_V2_FUNCTION_KEY || ''

// Reuse credential instance across calls (caches tokens internally).
let credential: DefaultAzureCredential | null = null

function getCredential(): DefaultAzureCredential {
  if (!credential) credential = new DefaultAzureCredential()
  return credential
}

export function isV2Configured(): boolean {
  return Boolean(V2_BASE_URL && V2_AUDIENCE)
}

// ─── Token acquisition ───────────────────────────────────────

async function getV2Token(): Promise<string> {
  const cred = getCredential()
  const scope = V2_AUDIENCE.endsWith('/.default')
    ? V2_AUDIENCE
    : `${V2_AUDIENCE}/.default`
  const token = await cred.getToken(scope)
  if (!token?.token) throw new Error('Failed to acquire v2 MI token')
  return token.token
}

// ─── HTTP helpers ────────────────────────────────────────────

async function v2Fetch<T>(path: string, timeoutMs = 8000): Promise<T | null> {
  if (!isV2Configured()) return null

  try {
    const token = await getV2Token()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    // Build URL with function key if available (needed while v2 has authLevel:'function')
    const separator = path.includes('?') ? '&' : '?'
    const url = V2_FUNCTION_KEY
      ? `${V2_BASE_URL}${path}${separator}code=${encodeURIComponent(V2_FUNCTION_KEY)}`
      : `${V2_BASE_URL}${path}`

    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!resp.ok) return null
    return (await resp.json()) as T
  } catch {
    // v2 unreachable, not deployed, or Step 5 not done yet — degrade gracefully.
    return null
  }
}

// ─── Public API ──────────────────────────────────────────────

export interface V2Conversation {
  phone: string
  customerName?: string
  customerEmail?: string
  lastMessageAt?: string
  lastMessagePreview?: string
  lastDirection?: 'inbound' | 'outbound'
  unreadCount?: number
  createdAt?: string
  updatedAt?: string
}

export interface V2Message {
  rowKey?: string
  direction: 'inbound' | 'outbound'
  waMessageId?: string
  wamid?: string
  contextMessageId?: string
  type?: string
  templateName?: string
  text?: string
  body?: string
  mediaUrl?: string
  mediaCaption?: string
  orderId?: string
  invoiceId?: string
  status?: string
  statusError?: string
  contactName?: string
  createdAt?: string
  updatedAt?: string
}

/**
 * Fetch conversation list from v2. Returns null on any failure.
 */
export async function fetchV2Conversations(): Promise<V2Conversation[] | null> {
  const data = await v2Fetch<{ conversations?: V2Conversation[] }>('/conversationsList')
  return data?.conversations ?? null
}

/**
 * Fetch all messages for a phone from v2. Returns null on any failure.
 */
export async function fetchV2Messages(phone: string): Promise<V2Message[] | null> {
  const data = await v2Fetch<{ messages?: V2Message[] }>(
    `/messagesList?phone=${encodeURIComponent(phone)}`,
  )
  return data?.messages ?? null
}

// ─── Diagnostic probe ────────────────────────────────────────

export interface V2ProbeResult {
  ok: boolean
  configured: boolean
  endpoint: string
  statusCode?: number
  conversationCount?: number
  latencyMs: number
  error?: string
}

/**
 * Live probe used by /api/admin/diagnostics. Hits the conversations endpoint
 * with the website backend MI token + function key (current dual-auth state)
 * and reports HTTP outcome. Unlike v2Fetch above, this surfaces the failure
 * mode rather than swallowing it, so the admin dashboard can show DOWN when
 * the backend cannot read the v2 inbox.
 *
 * `endpoint` is the path actually called — when a route mismatch occurs (e.g.
 * `/conversationsList` while v2 exposes `/conversations`), the path shown in
 * the diagnostic tile is the smoking gun the operator needs to see.
 */
export async function probeV2Reachability(): Promise<V2ProbeResult> {
  const t0 = Date.now()
  const path = '/conversationsList'

  if (!isV2Configured()) {
    return {
      ok: false,
      configured: false,
      endpoint: path,
      latencyMs: Date.now() - t0,
      error: 'WHATSAPP_V2_API_BASE_URL and/or WHATSAPP_V2_AUDIENCE missing',
    }
  }

  try {
    const token = await getV2Token()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)

    const separator = path.includes('?') ? '&' : '?'
    const url = V2_FUNCTION_KEY
      ? `${V2_BASE_URL}${path}${separator}code=${encodeURIComponent(V2_FUNCTION_KEY)}`
      : `${V2_BASE_URL}${path}`

    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!resp.ok) {
      return {
        ok: false,
        configured: true,
        endpoint: path,
        statusCode: resp.status,
        latencyMs: Date.now() - t0,
        error: `${resp.status} ${resp.statusText}`,
      }
    }

    const data = (await resp.json()) as { conversations?: V2Conversation[] }
    return {
      ok: true,
      configured: true,
      endpoint: path,
      statusCode: resp.status,
      conversationCount: data?.conversations?.length ?? 0,
      latencyMs: Date.now() - t0,
    }
  } catch (err) {
    return {
      ok: false,
      configured: true,
      endpoint: path,
      latencyMs: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
