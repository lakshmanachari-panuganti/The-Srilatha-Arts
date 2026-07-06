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
    // v2 unreachable, not deployed, or Step 5 not done yet - degrade gracefully.
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

// ─── Normalizers ──────────────────────────────────────────────
//
// v2 was built independently and uses slightly different field names than
// the website backend. Rather than coupling v2 to our schema, we accept
// the variants we've seen and normalize on the way in. Each lookup tries
// the website's canonical name first, then v2's likely aliases, then the
// Azure Tables system `Timestamp` field which is always populated.
//
// If a new field name appears in production we add it here, not in v2.

type Raw = Record<string, unknown>

function firstString(obj: Raw, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'string' && v.length > 0) return v
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  }
  return undefined
}

// Plausibility floor: anything before 2020-01-01 is almost certainly noise
// (an Azure Table row index, a phone digit run, etc.) rather than a real
// message timestamp. This keeps the "scan any field" fallback below from
// latching onto something stupid.
const PLAUSIBLE_TS_MIN_MS = Date.UTC(2020, 0, 1)
const PLAUSIBLE_TS_MAX_MS = Date.UTC(2100, 0, 1)

function tryParseDate(v: string): number | null {
  // JS Date is lenient about ISO but trips on the "2026-06-29 18:00:00" form
  // (space separator, no Z). Normalise both before parsing.
  const candidates = [v, v.replace(' ', 'T'), v.replace(' ', 'T') + 'Z']
  for (const c of candidates) {
    const t = new Date(c).getTime()
    if (!Number.isNaN(t) && t >= PLAUSIBLE_TS_MIN_MS && t < PLAUSIBLE_TS_MAX_MS) return t
  }
  return null
}

function tryParseNumeric(v: number): number | null {
  if (!Number.isFinite(v)) return null
  // Seconds-since-epoch land in ~1e9..1e10; milliseconds in ~1e12..1e13. Anything
  // smaller is too short to be a time, anything larger is way past 2100.
  const ms = v < 1e12 ? v * 1000 : v
  if (ms < PLAUSIBLE_TS_MIN_MS || ms >= PLAUSIBLE_TS_MAX_MS) return null
  return ms
}

function normalizeTimestamp(obj: Raw, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'string' && v.length >= 8) {
      const t = tryParseDate(v)
      if (t !== null) return new Date(t).toISOString()
    }
    if (typeof v === 'number') {
      const t = tryParseNumeric(v)
      if (t !== null) return new Date(t).toISOString()
    }
  }
  return undefined
}

// Last-resort fallback when none of the named keys hit - scan every field
// for a value that parses to a plausible timestamp. Useful when v2 introduces
// a field name we didn't anticipate (e.g. "sentTime", "Timestamp@odata.type").
// We score candidates so message-creation fields win over generic update
// fields when both exist.
function discoverTimestamp(obj: Raw, preferRegex: RegExp): string | undefined {
  let preferredMs: number | undefined
  let fallbackMs: number | undefined
  for (const [k, v] of Object.entries(obj)) {
    let ms: number | null = null
    if (typeof v === 'string' && v.length >= 8) ms = tryParseDate(v)
    else if (typeof v === 'number') ms = tryParseNumeric(v)
    if (ms === null) continue
    if (preferRegex.test(k)) {
      if (preferredMs === undefined || ms < preferredMs) preferredMs = ms
    } else if (fallbackMs === undefined) {
      fallbackMs = ms
    }
  }
  const winner = preferredMs ?? fallbackMs
  return winner !== undefined ? new Date(winner).toISOString() : undefined
}

function normalizeConversation(raw: Raw): V2Conversation {
  const phone =
    firstString(raw, ['phone', 'partitionKey', 'rowKey', 'contactPhone', 'from']) ?? ''
  // lastMessageAt powers the inbox sort + "X mins ago" badge - the most
  // visible "Invalid Date" symptom. Try canonical names, then scan any field
  // that looks like a recency timestamp.
  const lastMessageAt =
    normalizeTimestamp(raw, [
      'lastMessageAt',
      'lastMessageTime',
      'lastMessageTimestamp',
      'lastActivityAt',
      'lastInteractionAt',
      'updatedAt',
      'Timestamp',
    ]) ??
    discoverTimestamp(raw, /last|activity|interact|recent|updated|timestamp/i) ??
    ''
  const createdAt =
    normalizeTimestamp(raw, ['createdAt', 'firstMessageAt']) ??
    discoverTimestamp(raw, /created|first|start/i) ??
    ''
  const updatedAt =
    normalizeTimestamp(raw, ['updatedAt', 'Timestamp']) ?? lastMessageAt
  const unreadRaw = raw['unreadCount']
  const lastDirRaw = raw['lastDirection']
  return {
    phone,
    customerName: firstString(raw, ['customerName', 'contactName', 'name', 'pushName', 'profileName']) ?? '',
    customerEmail: firstString(raw, ['customerEmail', 'email']) ?? '',
    lastMessageAt,
    lastMessagePreview:
      firstString(raw, ['lastMessagePreview', 'lastMessage', 'preview', 'body', 'text']) ?? '',
    lastDirection: lastDirRaw === 'inbound' || lastDirRaw === 'outbound' ? lastDirRaw : undefined,
    unreadCount: typeof unreadRaw === 'number' ? unreadRaw : Number(unreadRaw ?? 0) || 0,
    createdAt,
    updatedAt,
  }
}

function normalizeMessage(raw: Raw): V2Message {
  const dirRaw = raw['direction']
  const direction: V2Message['direction'] =
    dirRaw === 'inbound' || dirRaw === 'outbound' ? dirRaw : 'inbound'
  return {
    rowKey: firstString(raw, ['rowKey', 'id']),
    direction,
    waMessageId: firstString(raw, ['waMessageId', 'wamid', 'messageId', 'id']),
    contextMessageId: firstString(raw, ['contextMessageId', 'contextId', 'replyTo']),
    type: firstString(raw, ['type', 'messageType']),
    templateName: firstString(raw, ['templateName', 'template']),
    text: firstString(raw, ['text', 'body', 'message']),
    mediaUrl: firstString(raw, ['mediaUrl', 'attachmentUrl', 'documentUrl']),
    mediaCaption: firstString(raw, ['mediaCaption', 'caption']),
    orderId: firstString(raw, ['orderId']),
    invoiceId: firstString(raw, ['invoiceId']),
    status: firstString(raw, ['status']),
    statusError: firstString(raw, ['statusError', 'errorMessage', 'error']),
    contactName: firstString(raw, ['contactName', 'customerName', 'pushName', 'profileName']),
    // createdAt drives the bubble's "X mins ago" footer and the chronological
    // sort. When v2 surfaces a field we didn't anticipate, fall back to the
    // first plausible timestamp on the row (preferring creation-shaped names).
    createdAt:
      normalizeTimestamp(raw, [
        'createdAt',
        'sentAt',
        'receivedAt',
        'messageTimestamp',
        'sentTimestamp',
        'timestamp',
        'time',
        'Timestamp',
      ]) ??
      discoverTimestamp(raw, /created|sent|received|message|timestamp|time|date/i) ??
      '',
    updatedAt:
      normalizeTimestamp(raw, ['updatedAt', 'modifiedAt', 'Timestamp']) ??
      discoverTimestamp(raw, /updated|modified|delivered|read/i) ??
      '',
  }
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Fetch conversation list from v2. Returns null on any failure.
 */
export async function fetchV2Conversations(): Promise<V2Conversation[] | null> {
  const data = await v2Fetch<{ conversations?: Raw[]; items?: Raw[] } | Raw[]>(
    '/conversations',
  )
  const rows = Array.isArray(data) ? data : (data?.conversations ?? data?.items)
  if (!rows) return null
  return rows.map(normalizeConversation).filter((c) => c.phone)
}

/**
 * Fetch all messages for a phone from v2. Returns null on any failure.
 *
 * v2's purpose-built detail route is /api/conversations/{phone} - same path
 * shape as contactsGet. Tried /messages?phone=… first; that returned 200 with
 * an empty `.messages` array (phone query not supported), which surfaced as
 * "Conversation not found" in the admin UI for v2-only threads.
 */
export async function fetchV2Messages(phone: string): Promise<V2Message[] | null> {
  const data = await v2Fetch<
    | { messages?: Raw[]; items?: Raw[]; conversation?: Raw }
    | Raw[]
  >(`/conversations/${encodeURIComponent(phone)}`)
  const rows = Array.isArray(data) ? data : (data?.messages ?? data?.items)
  if (!rows) return null
  return rows.map(normalizeMessage)
}

// ─── Mark conversation read ──────────────────────────────────

/**
 * POST to v2's mark-read endpoint so the centralized inbox no longer
 * shows the thread as unread.
 *
 * Idempotent - calling on a thread that's already at 0 is a no-op. We
 * return a boolean instead of throwing because the admin's "open thread"
 * flow must succeed even when v2 is briefly unreachable; the caller logs
 * and moves on.
 */
export async function markV2ConversationRead(phone: string): Promise<boolean> {
  if (!isV2Configured() || !phone) return false
  try {
    const token = await getV2Token()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 6000)

    const path = `/conversations/${encodeURIComponent(phone)}/read`
    const separator = path.includes('?') ? '&' : '?'
    const url = V2_FUNCTION_KEY
      ? `${V2_BASE_URL}${path}${separator}code=${encodeURIComponent(V2_FUNCTION_KEY)}`
      : `${V2_BASE_URL}${path}`

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    })
    clearTimeout(timer)
    return resp.ok
  } catch {
    return false
  }
}

// ─── Send (admin reply) ──────────────────────────────────────

export interface V2SendResult {
  ok: boolean
  messageId?: string
  statusCode?: number
  error?: string
}

/**
 * POST a free-form text reply through v2's send endpoint.
 *
 * Meta only allows free-form messages within the 24-hour customer-service
 * window (last inbound from this phone < 24h ago). Outside that window v2
 * will reject with an error; we surface it verbatim.
 *
 * Unlike v2Fetch (read paths, swallows errors), this surfaces the failure
 * mode - admin replies are user-initiated and silent failures would be
 * confusing.
 */
export async function sendV2Message(phone: string, text: string): Promise<V2SendResult> {
  if (!isV2Configured()) {
    return { ok: false, error: 'WHATSAPP_V2_API_BASE_URL/AUDIENCE not configured' }
  }
  const trimmed = text.trim()
  if (!trimmed) return { ok: false, error: 'Reply text is empty' }
  if (trimmed.length > 4096) {
    return { ok: false, error: 'Reply text exceeds 4096 characters' }
  }

  try {
    const token = await getV2Token()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)

    const path = '/messages/send'
    const separator = path.includes('?') ? '&' : '?'
    const url = V2_FUNCTION_KEY
      ? `${V2_BASE_URL}${path}${separator}code=${encodeURIComponent(V2_FUNCTION_KEY)}`
      : `${V2_BASE_URL}${path}`

    // Send the most explicit shape we can. v2 wraps Meta's Cloud API so it
    // should recognize `to` + `type: text` + `text: { body }`. If v2 expects
    // a flatter shape, extend the alias list in the same spirit as the read
    // normalizers above.
    const body = JSON.stringify({
      to: phone,
      type: 'text',
      text: { body: trimmed },
    })

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body,
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!resp.ok) {
      let errBody = ''
      try {
        errBody = (await resp.text()).slice(0, 500)
      } catch {
        // ignore
      }
      return {
        ok: false,
        statusCode: resp.status,
        error: `v2 ${resp.status} ${resp.statusText}${errBody ? ` · ${errBody}` : ''}`,
      }
    }

    const data = (await resp.json()) as Raw
    const messageId =
      firstString(data, ['messageId', 'wamid', 'waMessageId', 'id']) ??
      // Meta-style: { messages: [{ id }] }
      firstString(((data?.messages as Raw[] | undefined)?.[0] ?? {}) as Raw, ['id', 'messageId'])
    return { ok: true, statusCode: resp.status, messageId }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ─── Diagnostic probe ────────────────────────────────────────

export interface V2ProbeResult {
  ok: boolean
  configured: boolean
  endpoint: string
  statusCode?: number
  conversationCount?: number
  /** Keys of v2's first conversation row. Surfaces the raw shape so we can
   *  spot field-name drift between v2 and the website backend without
   *  redeploying. */
  sampleKeys?: string[]
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
 * `endpoint` is the path actually called - when a route mismatch occurs (e.g.
 * `/conversationsList` while v2 exposes `/conversations`), the path shown in
 * the diagnostic tile is the smoking gun the operator needs to see.
 */
export async function probeV2Reachability(): Promise<V2ProbeResult> {
  const t0 = Date.now()
  const path = '/conversations'

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

    const data = (await resp.json()) as
      | { conversations?: Raw[]; items?: Raw[] }
      | Raw[]
    const rows = Array.isArray(data) ? data : (data?.conversations ?? data?.items ?? [])
    const sampleKeys = rows[0] && typeof rows[0] === 'object' ? Object.keys(rows[0]) : undefined
    return {
      ok: true,
      configured: true,
      endpoint: path,
      statusCode: resp.status,
      conversationCount: rows.length,
      sampleKeys,
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
