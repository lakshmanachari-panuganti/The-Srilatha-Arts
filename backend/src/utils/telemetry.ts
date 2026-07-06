/**
 * Application Insights custom telemetry shim.
 *
 * Application Insights is provisioned (deploy script Phase 2.3) and the
 * Function App's managed identity has the Monitoring Metrics Publisher
 * role. What's been missing is application code emitting custom events.
 *
 * This helper wraps the `applicationinsights` SDK with three concerns
 * the rest of the codebase actually cares about:
 *
 *   - trackEvent(name, props)   - custom business events (payment captured,
 *                                  webhook signature failed, notification
 *                                  send failed). Surface in App Insights →
 *                                  Logs as `customEvents` table.
 *
 *   - trackException(err, props) - caught exceptions we want investigatable.
 *                                  Appears in Logs `exceptions` table with
 *                                  the stack trace + custom dimensions.
 *
 *   - trackMetric(name, value)   - scalar measurements (queue depth, refund
 *                                  amount, etc.). Surface in `customMetrics`.
 *
 * No-ops when APPLICATIONINSIGHTS_CONNECTION_STRING is unset (local dev).
 * The Function App in PRD has this set automatically by the deploy script.
 *
 * Initialisation is lazy + idempotent: first import wires the SDK; subsequent
 * imports re-use the already-initialised client. We deliberately do NOT call
 * `setup().start()` of the Functions auto-collection here - Azure Functions
 * runtime already collects request telemetry; what we add are *custom*
 * dimensions and business events.
 */

import * as appInsights from 'applicationinsights'
import { DefaultAzureCredential } from '@azure/identity'

let initialised = false
let client: appInsights.TelemetryClient | null = null

function init(): void {
  if (initialised) return
  initialised = true
  const conn = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING
  if (!conn) {
    // No connection string in this environment - telemetry calls become no-ops.
    return
  }
  try {
    appInsights
      .setup(conn)
      .setAutoCollectRequests(false)        // Functions runtime owns this
      .setAutoCollectDependencies(true)
      .setAutoCollectExceptions(true)
      .setSendLiveMetrics(false)
      .start()
    client = appInsights.defaultClient

    // AAD-authenticated ingest. Required when the AI resource has
    // `disableLocalAuth=true` (blocks the deprecated InstrumentationKey
    // path). The Function App's system-assigned managed identity already
    // holds `Monitoring Metrics Publisher` on the AI resource; the SDK
    // exchanges that MI token for an AI ingest token per call.
    // DefaultAzureCredential resolves to ManagedIdentityCredential in
    // Azure and to local dev credentials (VS/az CLI) otherwise, so this
    // path is safe on developer machines too.
    //
    // v2.9 SDK note: AAD is configured via client.config.aadTokenCredential
    // AFTER .start(), not through the fluent Configuration chain.
    if (
      client &&
      process.env.APPLICATIONINSIGHTS_AUTHENTICATION_STRING?.toLowerCase().includes('authorization=aad')
    ) {
      client.config.aadTokenCredential = new DefaultAzureCredential()
    }
  } catch (err) {
    // Don't let telemetry init break the function. Worst case is silent
    // observability - better than a 500 on the customer.
    // eslint-disable-next-line no-console
    console.warn('[telemetry] init failed', err)
  }
}

export type TelemetryProps = Record<string, string | number | boolean | null | undefined>

/**
 * Track a named business event. Common names:
 *   "payment.captured", "payment.failed", "webhook.signature_failed",
 *   "notification.send_failed", "order.transitioned", "review.submitted",
 *   "invoice.generated"
 */
export function trackEvent(name: string, properties?: TelemetryProps): void {
  init()
  if (!client) return
  try {
    client.trackEvent({
      name,
      properties: normalize(properties),
    })
  } catch {
    // never throw from telemetry
  }
}

/** Track a caught exception with optional custom dimensions. */
export function trackException(err: unknown, properties?: TelemetryProps): void {
  init()
  if (!client) return
  try {
    const error = err instanceof Error ? err : new Error(String(err))
    client.trackException({
      exception: error,
      properties: normalize(properties),
    })
  } catch {
    // never throw from telemetry
  }
}

/** Track a scalar measurement. */
export function trackMetric(name: string, value: number, properties?: TelemetryProps): void {
  init()
  if (!client) return
  try {
    client.trackMetric({
      name,
      value,
      properties: normalize(properties),
    })
  } catch {
    // never throw from telemetry
  }
}

/**
 * Force-flush in-flight telemetry. Useful at the end of long-running queue
 * consumers so the data lands in App Insights before the function ends.
 */
export async function flushTelemetry(): Promise<void> {
  init()
  if (!client) return
  await new Promise<void>((resolve) => {
    try {
      client!.flush({ callback: () => resolve() })
    } catch {
      resolve()
    }
  })
}

// App Insights properties must be strings. Coerce to string and drop null/undefined.
function normalize(props?: TelemetryProps): Record<string, string> | undefined {
  if (!props) return undefined
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue
    out[k] = String(v)
  }
  return out
}
