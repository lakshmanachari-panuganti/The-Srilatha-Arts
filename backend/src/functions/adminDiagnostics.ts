/**
 * Admin diagnostics endpoint — exposes every failure surface and
 * configuration gap that could prevent the order workflow from completing.
 *
 * GET /api/admin/diagnostics
 *
 * The intent is "show, don't fix". We deliberately surface the silent paths
 * (e.g. SMTP_USER unset → emails never sent but no thrown exception, just a
 * warn log) so operators can see the actual reason a customer never received
 * their confirmation email.
 *
 * Sections returned:
 *   - overall      Health summary + worst severity
 *   - workflow     Per-stage status (order create / payment / invoice /
 *                  email / whatsapp / db / external)
 *   - config       Every process.env.* the backend consumes, with set/unset
 *                  + validity findings + masked value preview
 *   - runtime      Live probes — SMTP transporter.verify(), storage, queue
 *                  depths, poison queue depths
 *   - recent       Counts of recent failures from emailLogs,
 *                  whatsappMessages, notificationAlerts, plus orders that
 *                  have emailStatus='failed' (catches the silent path)
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import nodemailer from 'nodemailer'
import { QueueServiceClient } from '@azure/storage-queue'
import { TableServiceClient } from '@azure/data-tables'
import { DefaultAzureCredential } from '@azure/identity'
import { requireAdmin } from '../middleware/adminGuard'
import { jsonResponse, errorResponse, corsPreflightResponse } from '../utils/response'
import {
  listAllEmailLogs,
  listAllWhatsAppMessages,
  getAllOrders,
  Row,
} from '../services/tableStorage'
import { listAlerts } from '../services/notificationAlerts'
import { probeV2Reachability, V2ProbeResult } from '../services/whatsappV2Client'

type Severity = 'critical' | 'warning' | 'info' | 'ok'

interface ConfigVar {
  name: string
  category:
    | 'email'
    | 'whatsapp'
    | 'storage'
    | 'razorpay'
    | 'google_oauth'
    | 'jwt'
    | 'site'
    | 'queues'
    | 'studio'
    | 'app_insights'
    | 'invoice'
  required: boolean
  set: boolean
  /** Mask all but the last few chars when set; never echo secret contents. */
  preview: string
  severity: Severity
  finding?: string
  description?: string
}

interface ProbeResult {
  name: string
  ok: boolean
  severity: Severity
  detail?: string
  latencyMs?: number
}

interface WorkflowStage {
  stage:
    | 'order_creation'
    | 'payment_processing'
    | 'invoice_generation'
    | 'email_notification'
    | 'whatsapp_notification'
    | 'whatsapp_inbox'
    | 'database'
    | 'external_api'
    | 'app_configuration'
  status: 'ok' | 'degraded' | 'down' | 'unknown'
  severity: Severity
  summary: string
  recentFailures: number
  lastFailureAt?: string
  lastError?: string
}

// ─── Masking helper ─────────────────────────────────────────────
// Echo enough to confirm "yes, the right secret is pasted" without revealing
// it. For secrets we show the last 4 chars + length. For non-secrets (host,
// sender email, etc.) we show the full value so operators can sanity-check.

const SECRET_NAMES = new Set([
  'SMTP_PASS',
  'JWT_SECRET',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_VERIFY_TOKEN',
  'APPLICATIONINSIGHTS_CONNECTION_STRING',
  'AzureWebJobsStorage',
])

function maskValue(name: string, raw: string | undefined): string {
  if (!raw) return ''
  if (SECRET_NAMES.has(name)) {
    const tail = raw.slice(-4)
    return `••••${tail} (length ${raw.length})`
  }
  return raw
}

// ─── Configuration audit ────────────────────────────────────────

interface VarSpec {
  name: string
  category: ConfigVar['category']
  required: boolean
  description: string
  /** Optional validator: return a finding string if the *set* value looks
   *  wrong. Returning null = OK. Not run when unset. */
  validate?: (raw: string) => string | null
}

const VAR_SPECS: VarSpec[] = [
  // ── Email / SMTP ───────────────────────────────────────────────
  {
    name: 'SMTP_USER',
    category: 'email',
    required: true,
    description: 'SMTP login username (Gmail address for the Gmail SMTP path).',
    validate: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'does not look like an email address'),
  },
  {
    name: 'SMTP_PASS',
    category: 'email',
    required: true,
    description: 'SMTP password / Gmail app password.',
    validate: (v) => (v.length < 8 ? `unexpectedly short (${v.length} chars)` : null),
  },
  {
    name: 'SMTP_HOST',
    category: 'email',
    required: false,
    description: 'SMTP server host. Defaults to smtp.gmail.com when unset.',
  },
  {
    name: 'SMTP_PORT',
    category: 'email',
    required: false,
    description: 'SMTP port. Defaults to 587 (STARTTLS) when unset.',
    validate: (v) =>
      Number.isFinite(Number(v)) && Number(v) > 0 ? null : 'not a positive integer',
  },
  {
    name: 'SMTP_SECURE',
    category: 'email',
    required: false,
    description: 'true/false: implicit TLS. Defaults to false (STARTTLS).',
  },
  {
    name: 'SMTP_SENDER_NAME',
    category: 'email',
    required: false,
    description: 'Display name on the From: header. Defaults to "Srilatha Art".',
  },
  {
    name: 'SMTP_SENDER_EMAIL',
    category: 'email',
    required: false,
    description: 'From: address. Falls back to SMTP_USER, then CONTACT.email.',
    validate: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'does not look like an email address'),
  },
  {
    name: 'SMTP_REPLY_TO',
    category: 'email',
    required: false,
    description: 'Reply-To: address. Falls back to CONTACT.email.',
    validate: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'does not look like an email address'),
  },
  {
    name: 'STUDIO_NOTIFICATION_CC',
    category: 'studio',
    required: false,
    description: 'Comma-separated studio CC addresses copied on every customer email.',
  },

  // ── WhatsApp ───────────────────────────────────────────────────
  {
    name: 'WHATSAPP_ACCESS_TOKEN',
    category: 'whatsapp',
    required: true,
    description: 'Meta Cloud API permanent system-user access token.',
    validate: (v) => (v.length < 40 ? `unexpectedly short (${v.length} chars) — Meta tokens are typically 100+` : null),
  },
  {
    name: 'WHATSAPP_PHONE_NUMBER_ID',
    category: 'whatsapp',
    required: true,
    description: 'Cloud API phone number id (the studio WABA sender id).',
    validate: (v) => (/^\d+$/.test(v) ? null : 'should be numeric'),
  },
  {
    name: 'WHATSAPP_WABA_ID',
    category: 'whatsapp',
    required: false,
    description: 'WhatsApp Business Account id.',
  },
  {
    name: 'WHATSAPP_API_VERSION',
    category: 'whatsapp',
    required: false,
    description: 'Cloud API version. Defaults to v23.0.',
  },
  {
    name: 'WHATSAPP_TEMPLATE_LANGUAGE',
    category: 'whatsapp',
    required: false,
    description: 'Template language. Defaults to en_US.',
  },
  {
    name: 'WHATSAPP_VERIFY_TOKEN',
    category: 'whatsapp',
    required: false,
    description: 'Webhook verification token (must match Meta dashboard config).',
  },
  {
    name: 'WHATSAPP_V2_API_BASE_URL',
    category: 'whatsapp',
    required: true,
    description: 'Base URL of the centralized v2 WhatsApp service (e.g. https://func-srilathaartwhatsappv2.azurewebsites.net/api). Backend reads inbound history from here.',
    validate: (v) => (/^https?:\/\/.+\/api$/.test(v) ? null : 'should be https://<host>/api (no trailing slash)'),
  },
  {
    name: 'WHATSAPP_V2_AUDIENCE',
    category: 'whatsapp',
    required: true,
    description: 'AAD audience (Application ID URI) of v2’s app registration, used for MI token acquisition.',
    validate: (v) => (/^api:\/\//.test(v) ? null : 'should start with api://'),
  },
  {
    name: 'WHATSAPP_V2_FUNCTION_KEY',
    category: 'whatsapp',
    required: false,
    description: 'v2 function key, only needed until v2’s admin functions move to authLevel:anonymous behind Easy Auth.',
  },

  // ── Storage / queues ───────────────────────────────────────────
  {
    name: 'AZURE_STORAGE_ACCOUNT_NAME',
    category: 'storage',
    required: true,
    description: 'Storage account name used by tables + queues + blobs.',
    validate: (v) => (/^[a-z0-9]{3,24}$/.test(v) ? null : 'invalid Azure storage account name'),
  },
  {
    name: 'AzureWebJobsStorage',
    category: 'storage',
    required: true,
    description: 'Connection string used by the Functions runtime (queue triggers).',
  },
  {
    name: 'NOTIFICATIONS_QUEUE_NAME',
    category: 'queues',
    required: false,
    description: 'Outbound notifications queue. Defaults to notifications-out.',
  },
  {
    name: 'WEBHOOKS_QUEUE_NAME',
    category: 'queues',
    required: false,
    description: 'Inbound webhooks queue. Defaults to webhooks-in.',
  },
  {
    name: 'REVIEW_QUEUE_NAME',
    category: 'queues',
    required: false,
    description: 'Delayed review-request queue. Defaults to review-requests.',
  },

  // ── Razorpay ───────────────────────────────────────────────────
  {
    name: 'RAZORPAY_KEY_ID',
    category: 'razorpay',
    required: true,
    description: 'Razorpay public key (rzp_test_… or rzp_live_…).',
    validate: (v) =>
      /^rzp_(test|live)_[A-Za-z0-9]+$/.test(v) ? null : 'invalid key id shape (expected rzp_test_… / rzp_live_…)',
  },
  {
    name: 'RAZORPAY_KEY_SECRET',
    category: 'razorpay',
    required: true,
    description: 'Razorpay API secret.',
  },
  {
    name: 'RAZORPAY_WEBHOOK_SECRET',
    category: 'razorpay',
    required: true,
    description: 'Razorpay webhook signing secret.',
  },

  // ── Google OAuth ───────────────────────────────────────────────
  {
    name: 'GOOGLE_CLIENT_ID',
    category: 'google_oauth',
    required: false,
    description: 'Google OAuth client id for customer sign-in. Optional.',
    validate: (v) => (v.endsWith('.apps.googleusercontent.com') ? null : 'does not match Google client id shape'),
  },

  // ── JWT / Auth ─────────────────────────────────────────────────
  {
    name: 'JWT_SECRET',
    category: 'jwt',
    required: true,
    description: 'JWT signing secret for customer + admin tokens.',
    validate: (v) => (v.length < 32 ? `unexpectedly short (${v.length} chars) — recommend 32+` : null),
  },

  // ── Site URLs / invoice ────────────────────────────────────────
  {
    name: 'PUBLIC_SITE_URL',
    category: 'site',
    required: false,
    description: 'Used to build absolute links in transactional emails.',
    validate: (v) => (/^https?:\/\//.test(v) ? null : 'should start with http(s)://'),
  },
  {
    name: 'INVOICE_PUBLIC_URL_BASE',
    category: 'invoice',
    required: false,
    description: 'Public base URL for invoice PDFs (used in WhatsApp DOCUMENT header).',
    validate: (v) => (/^https?:\/\//.test(v) ? null : 'should start with http(s)://'),
  },

  // ── Telemetry ──────────────────────────────────────────────────
  {
    name: 'APPLICATIONINSIGHTS_CONNECTION_STRING',
    category: 'app_insights',
    required: false,
    description: 'App Insights connection string for telemetry export.',
  },
]

function auditConfig(): ConfigVar[] {
  return VAR_SPECS.map((spec) => {
    const raw = process.env[spec.name]
    const trimmed = raw == null ? '' : String(raw).trim()
    const set = trimmed.length > 0
    let severity: Severity
    let finding: string | undefined
    if (!set) {
      if (spec.required) {
        severity = 'critical'
        finding = 'required but not set'
      } else {
        severity = 'info'
        finding = 'optional — using default'
      }
    } else if (spec.validate) {
      const issue = spec.validate(trimmed)
      if (issue) {
        severity = spec.required ? 'critical' : 'warning'
        finding = issue
      } else {
        severity = 'ok'
      }
    } else {
      severity = 'ok'
    }
    return {
      name: spec.name,
      category: spec.category,
      required: spec.required,
      set,
      preview: maskValue(spec.name, trimmed),
      severity,
      finding,
      description: spec.description,
    }
  })
}

// Pairwise sanity: settings that must / must-not appear together.
function pairwiseFindings(vars: ConfigVar[]): string[] {
  const findings: string[] = []
  const byName = new Map(vars.map((v) => [v.name, v]))
  const isSet = (n: string) => byName.get(n)?.set === true

  if (isSet('SMTP_USER') && !isSet('SMTP_PASS')) {
    findings.push('SMTP_USER is set but SMTP_PASS is missing — SMTP auth will fail.')
  }
  if (!isSet('SMTP_USER') && isSet('SMTP_PASS')) {
    findings.push('SMTP_PASS is set but SMTP_USER is missing — SMTP auth will fail.')
  }
  if (
    isSet('WHATSAPP_ACCESS_TOKEN') &&
    !isSet('WHATSAPP_PHONE_NUMBER_ID')
  ) {
    findings.push('WHATSAPP_ACCESS_TOKEN is set but WHATSAPP_PHONE_NUMBER_ID is missing.')
  }
  if (
    !isSet('WHATSAPP_ACCESS_TOKEN') &&
    isSet('WHATSAPP_PHONE_NUMBER_ID')
  ) {
    findings.push('WHATSAPP_PHONE_NUMBER_ID is set but WHATSAPP_ACCESS_TOKEN is missing.')
  }
  if (isSet('RAZORPAY_KEY_ID') && !isSet('RAZORPAY_KEY_SECRET')) {
    findings.push('RAZORPAY_KEY_ID is set but RAZORPAY_KEY_SECRET is missing.')
  }
  if (isSet('RAZORPAY_KEY_SECRET') && !isSet('RAZORPAY_WEBHOOK_SECRET')) {
    findings.push('RAZORPAY_KEY_SECRET is set but RAZORPAY_WEBHOOK_SECRET is missing — async payment webhooks will be rejected.')
  }

  return findings
}

// ─── Runtime probes ─────────────────────────────────────────────

async function probeSmtp(): Promise<ProbeResult> {
  const t0 = Date.now()
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!user || !pass) {
    return {
      name: 'smtp_verify',
      ok: false,
      severity: 'critical',
      detail: 'Skipped — SMTP_USER/SMTP_PASS not set. Email cannot be sent.',
    }
  }
  const host = process.env.SMTP_HOST || 'smtp.gmail.com'
  const port = Number(process.env.SMTP_PORT || 587)
  const secure =
    String(process.env.SMTP_SECURE ?? '').toLowerCase() === 'true' || port === 465
  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      requireTLS: !secure,
      // Short, bounded — the diagnostics call must never hang the UI.
      connectionTimeout: 8_000,
      greetingTimeout: 8_000,
      socketTimeout: 8_000,
    })
    await transporter.verify()
    transporter.close()
    return { name: 'smtp_verify', ok: true, severity: 'ok', latencyMs: Date.now() - t0 }
  } catch (err) {
    return {
      name: 'smtp_verify',
      ok: false,
      severity: 'critical',
      detail: err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - t0,
    }
  }
}

async function probeStorage(): Promise<ProbeResult> {
  const t0 = Date.now()
  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME
  if (!accountName) {
    return { name: 'storage', ok: false, severity: 'critical', detail: 'AZURE_STORAGE_ACCOUNT_NAME unset' }
  }
  try {
    const svc = new TableServiceClient(
      `https://${accountName}.table.core.windows.net`,
      new DefaultAzureCredential(),
    )
    await svc.listTables({ queryOptions: { top: 1 } as never }).next()
    return { name: 'storage', ok: true, severity: 'ok', latencyMs: Date.now() - t0 }
  } catch (err) {
    return {
      name: 'storage',
      ok: false,
      severity: 'critical',
      detail: err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - t0,
    }
  }
}

interface QueueDepth {
  name: string
  approxCount: number | null
  exists: boolean
  detail?: string
}

async function probeQueueDepths(): Promise<QueueDepth[]> {
  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME
  if (!accountName) return []
  const svc = new QueueServiceClient(
    `https://${accountName}.queue.core.windows.net`,
    new DefaultAzureCredential(),
  )
  const notif = process.env.NOTIFICATIONS_QUEUE_NAME || 'notifications-out'
  const webhooks = process.env.WEBHOOKS_QUEUE_NAME || 'webhooks-in'
  const review = process.env.REVIEW_QUEUE_NAME || 'review-requests'
  const queueNames = [
    notif,
    `${notif}-poison`,
    webhooks,
    `${webhooks}-poison`,
    review,
    `${review}-poison`,
  ]
  return Promise.all(
    queueNames.map(async (name): Promise<QueueDepth> => {
      try {
        const client = svc.getQueueClient(name)
        const props = await client.getProperties()
        // approximateMessagesCount is the SDK field name on QueueGetPropertiesResponse.
        const approx =
          (props as { approximateMessagesCount?: number }).approximateMessagesCount
        return { name, exists: true, approxCount: typeof approx === 'number' ? approx : null }
      } catch (err) {
        const code = (err as { statusCode?: number })?.statusCode
        if (code === 404) {
          return { name, exists: false, approxCount: null }
        }
        return {
          name,
          exists: false,
          approxCount: null,
          detail: err instanceof Error ? err.message : String(err),
        }
      }
    }),
  )
}

// ─── Recent failure counts ──────────────────────────────────────

interface RecentFailures {
  windowFromIso: string
  emailFailedCount: number
  emailFailedRecent: Array<{
    orderId: string
    to: string
    templateKey: string
    error?: string
    createdAt: string
  }>
  whatsappFailedCount: number
  whatsappFailedRecent: Array<{
    phone: string
    templateName: string
    error?: string
    createdAt: string
  }>
  openAlertCount: number
  finalAlertCount: number
  ordersWithEmailFailedCount: number
  ordersWithEmailFailedRecent: Array<{
    orderId: string
    customerEmail: string
    emailLastError?: string
    updatedAt?: string
    createdAt?: string
  }>
  ordersWithWhatsappFailedCount: number
}

async function computeRecentFailures(): Promise<RecentFailures> {
  const windowMs = 24 * 60 * 60 * 1000
  const from = new Date(Date.now() - windowMs).toISOString()

  const [emailRows, waRows, openAlerts, allAlerts, orders] = await Promise.all([
    listAllEmailLogs(from).catch(() => [] as Row[]),
    listAllWhatsAppMessages(from).catch(() => [] as Row[]),
    listAlerts({ includeAcknowledged: false }).catch(() => []),
    listAlerts({ includeAcknowledged: true }).catch(() => []),
    getAllOrders().catch(() => [] as Row[]),
  ])

  const emailFailed = emailRows.filter((r) => r.status === 'failed')
  const waFailed = waRows.filter((r) => r.direction === 'outbound' && r.status === 'failed')
  const finalAlerts = allAlerts.filter((a) => a.isFinal).length

  // Orders where the silent path put emailStatus=failed. Recent = updated
  // within the last 7 days. Even if the alert table now also covers this
  // (after the queue-side change), legacy rows from before the fix won't.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).getTime()
  const ordersEmailFailed = orders.filter((o) => {
    if (o.emailStatus !== 'failed') return false
    const ts = new Date((o.updatedAt as string) || (o.createdAt as string) || 0).getTime()
    return ts >= sevenDaysAgo
  })
  const ordersWaFailed = orders.filter((o) => {
    if (o.whatsappStatus !== 'failed') return false
    const ts = new Date((o.updatedAt as string) || (o.createdAt as string) || 0).getTime()
    return ts >= sevenDaysAgo
  })

  return {
    windowFromIso: from,
    emailFailedCount: emailFailed.length,
    emailFailedRecent: emailFailed.slice(0, 10).map((r) => ({
      orderId: String(r.partitionKey || r.orderId || ''),
      to: String(r.to || ''),
      templateKey: String(r.templateKey || ''),
      error: r.error ? String(r.error).slice(0, 500) : undefined,
      createdAt: String(r.createdAt || ''),
    })),
    whatsappFailedCount: waFailed.length,
    whatsappFailedRecent: waFailed.slice(0, 10).map((r) => ({
      phone: String(r.partitionKey || ''),
      templateName: String(r.templateName || ''),
      error: r.statusError ? String(r.statusError).slice(0, 500) : undefined,
      createdAt: String(r.createdAt || ''),
    })),
    openAlertCount: openAlerts.length,
    finalAlertCount: finalAlerts,
    ordersWithEmailFailedCount: ordersEmailFailed.length,
    ordersWithEmailFailedRecent: ordersEmailFailed.slice(0, 10).map((o) => ({
      orderId: String(o.rowKey || ''),
      customerEmail: String(o.customerEmail || ''),
      emailLastError: o.emailLastError ? String(o.emailLastError).slice(0, 500) : undefined,
      updatedAt: o.updatedAt ? String(o.updatedAt) : undefined,
      createdAt: o.createdAt ? String(o.createdAt) : undefined,
    })),
    ordersWithWhatsappFailedCount: ordersWaFailed.length,
  }
}

// ─── Workflow stage rollup ──────────────────────────────────────

function rollupWorkflow(
  vars: ConfigVar[],
  smtpProbe: ProbeResult,
  storageProbe: ProbeResult,
  queueDepths: QueueDepth[],
  recent: RecentFailures,
  v2Probe: V2ProbeResult,
): WorkflowStage[] {
  const byName = new Map(vars.map((v) => [v.name, v]))
  const stages: WorkflowStage[] = []

  // App configuration — worst severity of any var
  const worstConfig: Severity = vars.some((v) => v.severity === 'critical')
    ? 'critical'
    : vars.some((v) => v.severity === 'warning')
      ? 'warning'
      : 'ok'
  stages.push({
    stage: 'app_configuration',
    status: worstConfig === 'critical' ? 'down' : worstConfig === 'warning' ? 'degraded' : 'ok',
    severity: worstConfig,
    summary:
      worstConfig === 'ok'
        ? 'All checked App Settings are present and valid.'
        : `${vars.filter((v) => v.severity === 'critical').length} critical, ${vars.filter((v) => v.severity === 'warning').length} warning(s) in App Settings.`,
    recentFailures: 0,
  })

  // Email
  const smtpUser = byName.get('SMTP_USER')
  const smtpPass = byName.get('SMTP_PASS')
  let emailSev: Severity = 'ok'
  let emailSummary = 'SMTP credentials present; transporter.verify() succeeded.'
  if (!smtpUser?.set || !smtpPass?.set) {
    emailSev = 'critical'
    emailSummary = 'SMTP_USER and/or SMTP_PASS missing — order confirmation emails cannot be sent.'
  } else if (!smtpProbe.ok) {
    emailSev = 'critical'
    emailSummary = `SMTP connection failed: ${smtpProbe.detail || 'unknown error'}`
  } else if (recent.emailFailedCount > 0) {
    emailSev = 'warning'
    emailSummary = `${recent.emailFailedCount} email send failure(s) in the last 24h.`
  }
  const lastEmailErr = recent.emailFailedRecent[0]
  stages.push({
    stage: 'email_notification',
    status: emailSev === 'critical' ? 'down' : emailSev === 'warning' ? 'degraded' : 'ok',
    severity: emailSev,
    summary: emailSummary,
    recentFailures: recent.emailFailedCount + recent.ordersWithEmailFailedCount,
    lastFailureAt: lastEmailErr?.createdAt,
    lastError: lastEmailErr?.error,
  })

  // WhatsApp
  const waToken = byName.get('WHATSAPP_ACCESS_TOKEN')
  const waPhone = byName.get('WHATSAPP_PHONE_NUMBER_ID')
  let waSev: Severity = 'ok'
  let waSummary = 'WhatsApp credentials present.'
  if (!waToken?.set || !waPhone?.set) {
    waSev = 'critical'
    waSummary = 'WHATSAPP_ACCESS_TOKEN and/or WHATSAPP_PHONE_NUMBER_ID missing — WhatsApp messages cannot be sent.'
  } else if (recent.whatsappFailedCount > 0) {
    waSev = 'warning'
    waSummary = `${recent.whatsappFailedCount} WhatsApp send failure(s) in the last 24h.`
  }
  const lastWaErr = recent.whatsappFailedRecent[0]
  stages.push({
    stage: 'whatsapp_notification',
    status: waSev === 'critical' ? 'down' : waSev === 'warning' ? 'degraded' : 'ok',
    severity: waSev,
    summary: waSummary,
    recentFailures: recent.whatsappFailedCount,
    lastFailureAt: lastWaErr?.createdAt,
    lastError: lastWaErr?.error,
  })

  // WhatsApp inbox — does the backend reach the centralized v2 service?
  // Distinct from whatsapp_notification (which is outbound-credential-only).
  // This stage hits v2 live so a route/AAD/CORS regression surfaces here.
  let inboxSev: Severity = 'ok'
  const sampleSuffix = v2Probe.sampleKeys?.length
    ? ` · row keys: ${v2Probe.sampleKeys.join(', ')}`
    : ''
  let inboxSummary = `v2 reachable (${v2Probe.conversationCount ?? 0} conversations, ${v2Probe.latencyMs}ms).${sampleSuffix}`
  if (!v2Probe.configured) {
    inboxSev = 'critical'
    inboxSummary = `WHATSAPP_V2_* settings missing — admin inbox cannot read inbound messages. (${v2Probe.error ?? ''})`
  } else if (!v2Probe.ok) {
    inboxSev = 'critical'
    inboxSummary = `v2 ${v2Probe.endpoint} → ${v2Probe.statusCode ?? 'no response'} ${v2Probe.error ?? ''}`.trim()
  }
  stages.push({
    stage: 'whatsapp_inbox',
    status: inboxSev === 'critical' ? 'down' : 'ok',
    severity: inboxSev,
    summary: inboxSummary,
    recentFailures: 0,
    lastError: v2Probe.ok ? undefined : v2Probe.error,
  })

  // Database
  stages.push({
    stage: 'database',
    status: storageProbe.ok ? 'ok' : 'down',
    severity: storageProbe.ok ? 'ok' : 'critical',
    summary: storageProbe.ok
      ? `Azure Tables reachable (${storageProbe.latencyMs ?? '?'}ms).`
      : `Storage probe failed: ${storageProbe.detail || 'unknown error'}`,
    recentFailures: 0,
  })

  // Payment processing
  const rzpId = byName.get('RAZORPAY_KEY_ID')
  const rzpSecret = byName.get('RAZORPAY_KEY_SECRET')
  const rzpWebhook = byName.get('RAZORPAY_WEBHOOK_SECRET')
  let paySev: Severity = 'ok'
  let paySummary = 'Razorpay credentials present.'
  if (!rzpId?.set || !rzpSecret?.set) {
    paySev = 'critical'
    paySummary = 'Razorpay credentials missing — checkout will fail.'
  } else if (!rzpWebhook?.set) {
    paySev = 'warning'
    paySummary = 'RAZORPAY_WEBHOOK_SECRET missing — async payment webhooks will be rejected.'
  } else if ((rzpId.finding || rzpSecret.finding) && rzpId.severity === 'critical') {
    paySev = 'critical'
    paySummary = `Razorpay key shape invalid: ${rzpId.finding}`
  }
  stages.push({
    stage: 'payment_processing',
    status: paySev === 'critical' ? 'down' : paySev === 'warning' ? 'degraded' : 'ok',
    severity: paySev,
    summary: paySummary,
    recentFailures: 0,
  })

  // Invoice generation — surfaced via the invoice-channel alerts
  // (the orderFulfillment recordAlert path).
  stages.push({
    stage: 'invoice_generation',
    status: 'unknown',
    severity: 'info',
    summary:
      'Invoice failures surface via the notification alerts feed (channel=invoice). See alerts below.',
    recentFailures: 0,
  })

  // Order creation + external API are exercised only on request. We surface
  // notification-queue depth as a proxy for "stuck somewhere downstream".
  const notifQueue =
    queueDepths.find((q) => q.name === (process.env.NOTIFICATIONS_QUEUE_NAME || 'notifications-out'))
  const notifPoison =
    queueDepths.find((q) => q.name === `${process.env.NOTIFICATIONS_QUEUE_NAME || 'notifications-out'}-poison`)
  const poisonCount = notifPoison?.approxCount ?? 0
  let extSev: Severity = 'ok'
  let extSummary = 'No messages in notifications-out-poison.'
  if (poisonCount > 0) {
    extSev = 'warning'
    extSummary = `${poisonCount} message(s) in notifications-out-poison — queue retries exhausted.`
  }
  stages.push({
    stage: 'external_api',
    status: extSev === 'warning' ? 'degraded' : 'ok',
    severity: extSev,
    summary: extSummary,
    recentFailures: poisonCount,
  })

  stages.push({
    stage: 'order_creation',
    status: storageProbe.ok && rzpId?.set ? 'ok' : 'degraded',
    severity: storageProbe.ok && rzpId?.set ? 'ok' : 'warning',
    summary:
      storageProbe.ok && rzpId?.set
        ? 'Storage + Razorpay reachable; new orders can be created.'
        : 'One or more upstream dependencies degraded — see other stages.',
    recentFailures: 0,
  })

  return stages
}

// ─── Endpoint handler ───────────────────────────────────────────

async function adminDiagnostics(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  const admin = requireAdmin(request)
  if (!admin) return errorResponse('Unauthorized', 401, origin)

  try {
    const t0 = Date.now()
    const configVars = auditConfig()
    const crossFindings = pairwiseFindings(configVars)

    const [smtpProbe, storageProbe, queueDepths, recent, v2Probe] = await Promise.all([
      probeSmtp(),
      probeStorage(),
      probeQueueDepths().catch(() => [] as QueueDepth[]),
      computeRecentFailures(),
      probeV2Reachability(),
    ])

    const workflow = rollupWorkflow(
      configVars,
      smtpProbe,
      storageProbe,
      queueDepths,
      recent,
      v2Probe,
    )

    const overallSeverity: Severity = workflow.some((s) => s.severity === 'critical')
      ? 'critical'
      : workflow.some((s) => s.severity === 'warning')
        ? 'warning'
        : 'ok'

    return jsonResponse(
      {
        generatedAt: new Date().toISOString(),
        latencyMs: Date.now() - t0,
        overall: {
          severity: overallSeverity,
          headline:
            overallSeverity === 'critical'
              ? 'One or more order-workflow stages are down.'
              : overallSeverity === 'warning'
                ? 'Order workflow is operating with degraded stages.'
                : 'All checked stages are healthy.',
          crossFindings,
        },
        workflow,
        config: configVars,
        runtime: {
          smtp: smtpProbe,
          storage: storageProbe,
          queues: queueDepths,
        },
        recent,
      },
      200,
      { 'Cache-Control': 'no-store' },
      origin,
    )
  } catch (err) {
    context.error('adminDiagnostics failed', err)
    return errorResponse('Failed to load diagnostics', 500, origin)
  }
}

app.http('adminDiagnostics', {
  methods: ['GET', 'OPTIONS'],
  route: 'api/admin/diagnostics',
  authLevel: 'anonymous',
  handler: adminDiagnostics,
})
