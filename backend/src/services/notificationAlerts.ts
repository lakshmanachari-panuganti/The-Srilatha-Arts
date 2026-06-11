/**
 * Notification alerts — the single surface the admin sees for any
 * customer-facing communication failure or anomaly.
 *
 * Alerts cover:
 *   - 'email'      Email send failed (SMTP rejected, provider error, etc.)
 *   - 'whatsapp'   WhatsApp send failed (Meta API rejected, template error)
 *   - 'payment'    Payment captured AFTER cancellation, auto-refund initiated
 *   - 'invoice'    Invoice PDF generation failed
 *
 * Lifecycle:
 *   1. A failure occurs. `recordAlert` is called. Row is upserted by
 *      a composite dedup key so repeated failures of the same notification
 *      update the same row (incrementing attempts) instead of flooding.
 *   2. The queue retries. If the retry succeeds, `clearAlert` deletes the
 *      open row — the failure was transient and is no longer actionable.
 *   3. If the queue exhausts retries (attempt === maxDequeueCount), the
 *      alert's `isFinal` flips to true. Dashboard renders this in red.
 *   4. Admin acknowledges via `acknowledgeAlert`. Row stays for audit —
 *      `status` flips from 'open' to 'acknowledged' so the dashboard
 *      hides it, but the historical record is preserved.
 *
 * Dedup key:
 *   `${orderId}__${channel}__${operation}` — single row per (order,
 *   channel, operation). 'operation' is the templateKey for email/whatsapp,
 *   and a short identifier ('payment_after_cancel', 'invoice_generation')
 *   for the payment/invoice channels.
 *
 * History is NEVER deleted programmatically — acknowledged alerts stay
 * queryable via `listAlerts({ includeAcknowledged: true })`. Support
 * staff and audit reviewers see the full record.
 */

import { TableClient, odata } from '@azure/data-tables'
import { DefaultAzureCredential } from '@azure/identity'

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME!
const credential = new DefaultAzureCredential()

function getTableClient(): TableClient {
  return new TableClient(
    `https://${accountName}.table.core.windows.net`,
    'notificationAlerts',
    credential,
  )
}

// Ensure-table cache. Mirrors the pattern in tableStorage.ts so a cold
// start that hits this table for the first time bootstraps it.
let _ensured = false
async function ensure(): Promise<TableClient> {
  const client = getTableClient()
  if (_ensured) return client
  try {
    await client.createTable()
  } catch (e: unknown) {
    const code = (e as { code?: string; details?: { errorCode?: string }; statusCode?: number })
    const ec = code?.code || code?.details?.errorCode || ''
    if (ec !== 'TableAlreadyExists' && code?.statusCode !== 409) {
      throw e
    }
  }
  _ensured = true
  return client
}

export type AlertChannel = 'email' | 'whatsapp' | 'payment' | 'invoice'
export type AlertStatus = 'open' | 'acknowledged'

export interface NotificationAlert {
  rowKey: string
  partitionKey: string
  orderId: string
  channel: AlertChannel
  operation: string             // templateKey for email/whatsapp; short identifier otherwise
  customerName: string
  customerContact: string
  reason: string
  attempts: number
  isFinal: boolean
  firstFailureAt: string
  lastFailureAt: string
  status: AlertStatus
  acknowledgedAt?: string
  acknowledgedBy?: string
  createdAt: string
  updatedAt: string
}

/**
 * Build the canonical dedup key for an alert. Replaces characters that
 * would conflict with Table Storage's row-key syntax (/, \, #, ?).
 */
export function buildAlertRowKey(orderId: string, channel: AlertChannel, operation: string): string {
  const safe = (s: string) => s.replace(/[/\\#?]/g, '_')
  return `${safe(orderId)}__${safe(channel)}__${safe(operation)}`
}

export interface RecordAlertInput {
  orderId: string
  channel: AlertChannel
  operation: string
  customerName?: string
  customerContact?: string
  reason: string
  attempt: number
  /** When the queue won't retry further — exhausted maxDequeueCount, or
   *  the failure is non-retryable (e.g. captured-after-cancel which is
   *  a logic event, not a transient error). */
  isFinal: boolean
}

/**
 * Record a notification failure. Upserts by composite key so repeated
 * failures of the same (order, channel, operation) update one row
 * instead of creating duplicates. Always safe to call from a catch
 * block — failures here are logged but never thrown to callers.
 */
export async function recordAlert(input: RecordAlertInput): Promise<void> {
  try {
    const client = await ensure()
    const rowKey = buildAlertRowKey(input.orderId, input.channel, input.operation)
    const now = new Date().toISOString()
    // Read existing to preserve firstFailureAt + createdAt across retries.
    let existing: NotificationAlert | null = null
    try {
      existing = (await client.getEntity('alert', rowKey)) as unknown as NotificationAlert
    } catch (err: unknown) {
      const code = (err as { statusCode?: number })?.statusCode
      if (code !== 404) throw err
    }

    const entity: NotificationAlert = {
      partitionKey: 'alert',
      rowKey,
      orderId: input.orderId,
      channel: input.channel,
      operation: input.operation,
      customerName: input.customerName || existing?.customerName || '',
      customerContact: input.customerContact || existing?.customerContact || '',
      reason: input.reason.slice(0, 2000),
      attempts: Math.max(existing?.attempts || 0, input.attempt),
      isFinal: input.isFinal || existing?.isFinal || false,
      firstFailureAt: existing?.firstFailureAt || now,
      lastFailureAt: now,
      // If the admin acknowledged a previous instance of this alert and a
      // new failure follows, reopen it — re-acknowledgement should be a
      // conscious action, not silent suppression of recurring issues.
      status: 'open',
      acknowledgedAt: existing?.acknowledgedAt,
      acknowledgedBy: existing?.acknowledgedBy,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    }

    await client.upsertEntity(entity as unknown as { partitionKey: string; rowKey: string }, 'Replace')
  } catch (err) {
    // Never throw — telemetry must not break business logic.
    // eslint-disable-next-line no-console
    console.warn('[notificationAlerts] recordAlert failed', err)
  }
}

/**
 * Delete an alert when the underlying notification eventually succeeds
 * (e.g. queue retry succeeds after early failures). Idempotent — safe
 * to call when no row exists.
 */
export async function clearAlert(
  orderId: string,
  channel: AlertChannel,
  operation: string,
): Promise<void> {
  try {
    const client = await ensure()
    const rowKey = buildAlertRowKey(orderId, channel, operation)
    await client.deleteEntity('alert', rowKey)
  } catch (err: unknown) {
    const code = (err as { statusCode?: number })?.statusCode
    if (code === 404) return // no-op
    // eslint-disable-next-line no-console
    console.warn('[notificationAlerts] clearAlert failed', err)
  }
}

/**
 * List alerts. Default = only open + final-failure ones the admin needs
 * to act on. Pass `includeAcknowledged: true` for the audit history.
 */
export interface ListAlertsOptions {
  includeAcknowledged?: boolean
  channel?: AlertChannel
  orderId?: string
  limit?: number
}

export async function listAlerts(opts: ListAlertsOptions = {}): Promise<NotificationAlert[]> {
  const client = await ensure()
  const filters: string[] = ['PartitionKey eq \'alert\'']
  if (!opts.includeAcknowledged) filters.push('status eq \'open\'')
  if (opts.channel) filters.push(odata`channel eq ${opts.channel}`)
  if (opts.orderId) filters.push(odata`orderId eq ${opts.orderId}`)
  const filter = filters.join(' and ')

  const rows: NotificationAlert[] = []
  for await (const e of client.listEntities({ queryOptions: { filter } })) {
    rows.push(e as unknown as NotificationAlert)
    if (opts.limit && rows.length >= opts.limit * 3) break // overfetch slightly; sort below
  }

  // Sort newest first by lastFailureAt
  rows.sort((a, b) => String(b.lastFailureAt || '').localeCompare(String(a.lastFailureAt || '')))
  if (opts.limit) return rows.slice(0, opts.limit)
  return rows
}

/**
 * Acknowledge an alert. Row stays in the table for audit — only the
 * status flag changes. Re-failure of the same (order, channel, operation)
 * reopens it.
 */
export async function acknowledgeAlert(rowKey: string, adminId: string): Promise<NotificationAlert | null> {
  const client = await ensure()
  let row: NotificationAlert
  try {
    row = (await client.getEntity('alert', rowKey)) as unknown as NotificationAlert
  } catch (err: unknown) {
    const code = (err as { statusCode?: number })?.statusCode
    if (code === 404) return null
    throw err
  }
  const now = new Date().toISOString()
  const updated: NotificationAlert = {
    ...row,
    status: 'acknowledged',
    acknowledgedAt: now,
    acknowledgedBy: adminId,
    updatedAt: now,
  }
  await client.upsertEntity(updated as unknown as { partitionKey: string; rowKey: string }, 'Replace')
  return updated
}
