'use client'

/**
 * SystemDiagnosticsCard - single surface that exposes every configuration
 * gap, runtime probe failure, and recent error across the order workflow.
 *
 * Read-only operational view. No actions taken; intent is to surface root
 * causes (e.g. SMTP_USER missing → emails never delivered → no exception
 * thrown anywhere) so an operator can fix App Settings, then verify.
 *
 * Refresh: manual button + 60s auto-refresh via React Query.
 */

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Mail,
  MessageCircle,
  Inbox,
  Database,
  IndianRupee,
  FileText,
  ShoppingBag,
  Settings as SettingsIcon,
  Cable,
  RefreshCw,
  Loader2,
  Info,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'

type Severity = 'critical' | 'warning' | 'info' | 'ok'

interface ConfigVar {
  name: string
  category: string
  required: boolean
  set: boolean
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

interface QueueDepth {
  name: string
  approxCount: number | null
  exists: boolean
  detail?: string
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

interface DiagnosticsResponse {
  generatedAt: string
  latencyMs: number
  overall: {
    severity: Severity
    headline: string
    crossFindings: string[]
  }
  workflow: WorkflowStage[]
  config: ConfigVar[]
  runtime: {
    smtp: ProbeResult
    storage: ProbeResult
    queues: QueueDepth[]
  }
  recent: RecentFailures
}

const STAGE_LABEL: Record<WorkflowStage['stage'], string> = {
  order_creation: 'Order creation',
  payment_processing: 'Payment processing',
  invoice_generation: 'Invoice generation',
  email_notification: 'Email notification',
  whatsapp_notification: 'WhatsApp notification',
  whatsapp_inbox: 'WhatsApp inbox (v2)',
  database: 'Database',
  external_api: 'External APIs / queues',
  app_configuration: 'App Settings',
}

const STAGE_ICON: Record<WorkflowStage['stage'], React.ElementType> = {
  order_creation: ShoppingBag,
  payment_processing: IndianRupee,
  invoice_generation: FileText,
  email_notification: Mail,
  whatsapp_notification: MessageCircle,
  whatsapp_inbox: Inbox,
  database: Database,
  external_api: Cable,
  app_configuration: SettingsIcon,
}

const CATEGORY_LABEL: Record<string, string> = {
  email: 'Email / SMTP',
  whatsapp: 'WhatsApp',
  storage: 'Storage',
  razorpay: 'Razorpay (payments)',
  google_oauth: 'Google OAuth',
  jwt: 'JWT / Auth',
  site: 'Site URLs',
  queues: 'Storage queues',
  studio: 'Studio CC',
  app_insights: 'App Insights',
  invoice: 'Invoice URLs',
}

export default function SystemDiagnosticsCard() {
  const qc = useQueryClient()
  const [showConfig, setShowConfig] = useState(false)
  const [showRecent, setShowRecent] = useState(false)
  const { data, isLoading, isError, error, isFetching } = useQuery<DiagnosticsResponse>({
    queryKey: ['admin-diagnostics'],
    queryFn: () => apiFetch<DiagnosticsResponse>('/admin/diagnostics'),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <section className="bg-plum-light border border-ink/10 rounded-xl p-6 mb-6 animate-pulse">
        <div className="h-5 w-56 bg-ink/10 rounded mb-3" />
        <div className="h-4 w-80 bg-ink/10 rounded" />
      </section>
    )
  }

  if (isError || !data) {
    return (
      <section className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 mb-6 text-sm text-red-200">
        <p className="font-medium mb-1">Could not load system diagnostics</p>
        <p className="text-xs text-red-300/80">
          {error instanceof Error ? error.message : 'Unexpected error'}
        </p>
      </section>
    )
  }

  const sev = data.overall.severity
  const banner = bannerClasses(sev)

  // Per-category config buckets
  const byCategory = data.config.reduce<Record<string, ConfigVar[]>>((acc, v) => {
    ;(acc[v.category] = acc[v.category] || []).push(v)
    return acc
  }, {})

  return (
    <section className={`border rounded-xl mb-6 overflow-hidden ${banner.wrapper}`}>
      <header className={`px-6 py-4 flex items-start justify-between gap-4 ${banner.headerBg}`}>
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <SeverityIcon severity={sev} />
          <div className="min-w-0">
            <h2 className="font-serif text-xl text-ink">System Diagnostics</h2>
            <p className="text-xs text-ink-soft mt-0.5">
              {data.overall.headline} · Generated{' '}
              {new Date(data.generatedAt).toLocaleTimeString('en-IN')}
              {data.latencyMs ? ` · ${data.latencyMs}ms` : ''}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => qc.invalidateQueries({ queryKey: ['admin-diagnostics'] })}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-ink/20 text-xs font-medium text-ink hover:bg-white/5 disabled:opacity-50 transition-colors"
        >
          {isFetching ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Refresh
        </button>
      </header>

      <div className="px-6 py-5 space-y-5">
        {data.overall.crossFindings.length > 0 && (
          <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 space-y-1">
            <p className="text-xs font-semibold text-amber-200 uppercase tracking-wider">
              Cross-setting findings
            </p>
            <ul className="text-sm text-amber-100 list-disc list-inside space-y-0.5">
              {data.overall.crossFindings.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Workflow stages */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.workflow.map((stage) => (
            <StageRow key={stage.stage} stage={stage} />
          ))}
        </div>

        {/* Runtime probes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ProbeRow probe={data.runtime.smtp} label="SMTP transporter.verify()" />
          <ProbeRow probe={data.runtime.storage} label="Azure Tables reachability" />
        </div>

        {/* Queue depths */}
        {data.runtime.queues.length > 0 && (
          <div className="rounded-lg border border-ink/10 bg-plum-light/60 p-4">
            <p className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-2">
              Queue depths
            </p>
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs">
              {data.runtime.queues.map((q) => (
                <li key={q.name} className="flex items-center justify-between gap-2">
                  <span className="text-ink-soft truncate font-mono">{q.name}</span>
                  <QueueBadge q={q} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* App Settings details (collapsible) */}
        <CollapsibleSection
          open={showConfig}
          onToggle={() => setShowConfig((v) => !v)}
          title={`App Settings (${data.config.length} variables checked)`}
          subtitle={summariseConfig(data.config)}
        >
          <div className="space-y-4 pt-3">
            {Object.entries(byCategory).map(([cat, vars]) => (
              <div key={cat}>
                <p className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-2">
                  {CATEGORY_LABEL[cat] || cat}
                </p>
                <ul className="space-y-1">
                  {vars.map((v) => (
                    <ConfigVarRow key={v.name} v={v} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* Recent failures (collapsible) */}
        <CollapsibleSection
          open={showRecent}
          onToggle={() => setShowRecent((v) => !v)}
          title="Recent failures (last 24h)"
          subtitle={summariseRecent(data.recent)}
        >
          <RecentSection recent={data.recent} />
        </CollapsibleSection>
      </div>
    </section>
  )
}

// ─── Workflow stage row ───────────────────────────────────────

function StageRow({ stage }: { stage: WorkflowStage }) {
  const Icon = STAGE_ICON[stage.stage]
  const cls = severityChipClasses(stage.severity)
  return (
    <div className={`rounded-lg border p-3 ${cls.border} ${cls.bg}`}>
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${cls.iconBg}`}>
          <Icon className={`w-4 h-4 ${cls.iconColor}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-ink">{STAGE_LABEL[stage.stage]}</p>
            <SeverityBadge severity={stage.severity} status={stage.status} />
          </div>
          <p className="text-xs text-ink-soft mt-0.5 break-words">{stage.summary}</p>
          {stage.lastError && (
            <p className="text-[11px] text-ink-mute mt-1 font-mono break-words line-clamp-3">
              {stage.lastError}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Probe row ────────────────────────────────────────────────

function ProbeRow({ probe, label }: { probe: ProbeResult; label: string }) {
  const cls = severityChipClasses(probe.severity)
  return (
    <div className={`rounded-lg border p-3 ${cls.border} ${cls.bg}`}>
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-ink">{label}</p>
        <SeverityBadge severity={probe.severity} status={probe.ok ? 'ok' : 'down'} />
        {typeof probe.latencyMs === 'number' && (
          <span className="text-[11px] text-ink-mute">{probe.latencyMs}ms</span>
        )}
      </div>
      {probe.detail && (
        <p className="text-xs text-ink-soft mt-1 break-words font-mono">{probe.detail}</p>
      )}
    </div>
  )
}

// ─── Queue badge ──────────────────────────────────────────────

function QueueBadge({ q }: { q: QueueDepth }) {
  if (!q.exists) {
    return <span className="text-ink-mute">not found</span>
  }
  if (q.approxCount === null) {
    return <span className="text-ink-mute">?</span>
  }
  const isPoison = q.name.endsWith('-poison')
  const hot = q.approxCount > 0
  const cls = isPoison && hot
    ? 'text-red-200 bg-red-500/15 ring-red-500/30'
    : hot
      ? 'text-amber-200 bg-amber-500/15 ring-amber-500/30'
      : 'text-emerald-200 bg-emerald-500/15 ring-emerald-500/30'
  return (
    <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ring-1 ring-inset ${cls}`}>
      {q.approxCount}
    </span>
  )
}

// ─── Config row ───────────────────────────────────────────────

function ConfigVarRow({ v }: { v: ConfigVar }) {
  const dot = severityDotClass(v.severity)
  return (
    <li className="grid grid-cols-[auto_1fr_auto] items-start gap-3 text-xs py-1.5 px-2 rounded hover:bg-white/[0.02]">
      <span className={`mt-1 inline-block w-2 h-2 rounded-full shrink-0 ${dot}`} />
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-ink truncate">{v.name}</span>
          {v.required && !v.set && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-200 ring-1 ring-red-500/30 uppercase tracking-wider">
              required
            </span>
          )}
          {!v.required && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-ink-mute uppercase tracking-wider">
              optional
            </span>
          )}
        </div>
        {v.set ? (
          <p className="text-ink-soft font-mono break-all">{v.preview}</p>
        ) : (
          <p className="text-ink-mute">unset</p>
        )}
        {v.finding && (
          <p className={`mt-0.5 ${v.severity === 'critical' ? 'text-red-200' : v.severity === 'warning' ? 'text-amber-200' : 'text-ink-mute'}`}>
            {v.finding}
          </p>
        )}
        {v.description && (
          <p className="text-ink-mute mt-0.5">{v.description}</p>
        )}
      </div>
    </li>
  )
}

// ─── Recent section ───────────────────────────────────────────

function RecentSection({ recent }: { recent: RecentFailures }) {
  return (
    <div className="space-y-4 pt-3 text-xs">
      <RecentStat
        label="Email send failures (emailLogs)"
        count={recent.emailFailedCount}
        icon={Mail}
      />
      {recent.emailFailedRecent.length > 0 && (
        <ul className="ml-6 space-y-1.5">
          {recent.emailFailedRecent.map((r, i) => (
            <li key={i} className="text-ink-soft border-l-2 border-red-500/30 pl-3">
              <span className="font-mono text-ink">{r.orderId}</span>
              <span className="text-ink-mute"> → </span>
              <span className="font-mono">{r.to}</span>
              <span className="text-ink-mute"> · </span>
              <span>{r.templateKey}</span>
              {r.error && (
                <p className="text-[11px] text-red-200 font-mono break-words mt-0.5 line-clamp-2">
                  {r.error}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <RecentStat
        label="Orders with emailStatus = failed (last 7d)"
        count={recent.ordersWithEmailFailedCount}
        icon={ShoppingBag}
        hint="Catches the silent SMTP-not-configured path where the queue consumer returned without throwing."
      />
      {recent.ordersWithEmailFailedRecent.length > 0 && (
        <ul className="ml-6 space-y-1.5">
          {recent.ordersWithEmailFailedRecent.map((r, i) => (
            <li key={i} className="text-ink-soft border-l-2 border-amber-500/40 pl-3">
              <span className="font-mono text-ink">{r.orderId}</span>
              <span className="text-ink-mute"> → </span>
              <span className="font-mono">{r.customerEmail || '(no email)'}</span>
              {r.emailLastError && (
                <p className="text-[11px] text-amber-200 font-mono break-words mt-0.5 line-clamp-2">
                  {r.emailLastError}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <RecentStat
        label="WhatsApp send failures"
        count={recent.whatsappFailedCount}
        icon={MessageCircle}
      />
      {recent.whatsappFailedRecent.length > 0 && (
        <ul className="ml-6 space-y-1.5">
          {recent.whatsappFailedRecent.map((r, i) => (
            <li key={i} className="text-ink-soft border-l-2 border-red-500/30 pl-3">
              <span className="font-mono text-ink">{r.phone}</span>
              <span className="text-ink-mute"> · </span>
              <span>{r.templateName}</span>
              {r.error && (
                <p className="text-[11px] text-red-200 font-mono break-words mt-0.5 line-clamp-2">
                  {r.error}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <RecentStat
        label="Orders with whatsappStatus = failed (last 7d)"
        count={recent.ordersWithWhatsappFailedCount}
        icon={ShoppingBag}
      />

      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-ink/10">
        <RecentStat label="Open alerts" count={recent.openAlertCount} icon={AlertTriangle} />
        <RecentStat label="Final-failure alerts" count={recent.finalAlertCount} icon={AlertOctagon} />
      </div>
    </div>
  )
}

function RecentStat({
  label,
  count,
  icon: Icon,
  hint,
}: {
  label: string
  count: number
  icon: React.ElementType
  hint?: string
}) {
  const hot = count > 0
  return (
    <div>
      <div className="flex items-center gap-2 text-ink">
        <Icon className={`w-3.5 h-3.5 ${hot ? 'text-amber-300' : 'text-ink-mute'}`} />
        <span className="text-sm">{label}</span>
        <span
          className={`ml-auto text-xs px-1.5 py-0.5 rounded font-mono font-medium ring-1 ring-inset ${
            hot
              ? 'bg-amber-500/15 text-amber-200 ring-amber-500/30'
              : 'bg-white/5 text-ink-soft ring-white/10'
          }`}
        >
          {count}
        </span>
      </div>
      {hint && <p className="text-[11px] text-ink-mute mt-0.5 ml-5">{hint}</p>}
    </div>
  )
}

// ─── Severity primitives ──────────────────────────────────────

function SeverityIcon({ severity }: { severity: Severity }) {
  if (severity === 'critical') return <AlertOctagon className="w-6 h-6 text-red-300 shrink-0 mt-0.5" />
  if (severity === 'warning') return <AlertTriangle className="w-6 h-6 text-amber-300 shrink-0 mt-0.5" />
  if (severity === 'info') return <Info className="w-6 h-6 text-blue shrink-0 mt-0.5" />
  return <CheckCircle2 className="w-6 h-6 text-emerald-300 shrink-0 mt-0.5" />
}

function SeverityBadge({
  severity,
  status,
}: {
  severity: Severity
  status?: WorkflowStage['status']
}) {
  const label =
    status === 'down'
      ? 'DOWN'
      : status === 'degraded'
        ? 'DEGRADED'
        : status === 'unknown'
          ? 'UNKNOWN'
          : severity === 'critical'
            ? 'CRITICAL'
            : severity === 'warning'
              ? 'WARNING'
              : severity === 'info'
                ? 'INFO'
                : 'OK'
  const cls =
    severity === 'critical'
      ? 'bg-red-500/15 text-red-200 ring-red-500/30'
      : severity === 'warning'
        ? 'bg-amber-500/15 text-amber-200 ring-amber-500/30'
        : severity === 'info'
          ? 'bg-blue/15 text-blue ring-blue/30'
          : 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/30'
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ring-1 ring-inset uppercase tracking-wider ${cls}`}>
      {label}
    </span>
  )
}

function severityChipClasses(sev: Severity) {
  if (sev === 'critical') {
    return {
      border: 'border-red-500/30',
      bg: 'bg-red-500/[0.06]',
      iconBg: 'bg-red-500/15',
      iconColor: 'text-red-200',
    }
  }
  if (sev === 'warning') {
    return {
      border: 'border-amber-500/30',
      bg: 'bg-amber-500/[0.06]',
      iconBg: 'bg-amber-500/15',
      iconColor: 'text-amber-200',
    }
  }
  if (sev === 'info') {
    return {
      border: 'border-blue/25',
      bg: 'bg-blue/[0.06]',
      iconBg: 'bg-blue/15',
      iconColor: 'text-blue',
    }
  }
  return {
    border: 'border-emerald-500/25',
    bg: 'bg-emerald-500/[0.05]',
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-200',
  }
}

function severityDotClass(sev: Severity): string {
  if (sev === 'critical') return 'bg-red-400 shadow-[0_0_0_3px_rgba(239,68,68,0.18)]'
  if (sev === 'warning') return 'bg-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.18)]'
  if (sev === 'info') return 'bg-blue shadow-[0_0_0_3px_rgba(59,130,246,0.18)]'
  return 'bg-emerald-400 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]'
}

function bannerClasses(sev: Severity) {
  if (sev === 'critical') {
    return {
      wrapper: 'border-red-500/40 bg-red-500/[0.04]',
      headerBg: 'bg-red-500/10 border-b border-red-500/20',
    }
  }
  if (sev === 'warning') {
    return {
      wrapper: 'border-amber-500/40 bg-amber-500/[0.04]',
      headerBg: 'bg-amber-500/10 border-b border-amber-500/20',
    }
  }
  return {
    wrapper: 'border-ink/10 bg-plum-light',
    headerBg: 'bg-white/[0.02] border-b border-ink/10',
  }
}

// ─── Collapsible ──────────────────────────────────────────────

function CollapsibleSection({
  open,
  onToggle,
  title,
  subtitle,
  children,
}: {
  open: boolean
  onToggle: () => void
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-ink/10 bg-plum-light/60">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 p-3 text-left hover:bg-white/[0.03] rounded-lg transition-colors"
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-ink-soft shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-ink-soft shrink-0" />
        )}
        <span className="text-sm font-medium text-ink">{title}</span>
        <span className="text-xs text-ink-mute ml-auto truncate">{subtitle}</span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

// ─── Summaries ────────────────────────────────────────────────

function summariseConfig(vars: ConfigVar[]): string {
  const critical = vars.filter((v) => v.severity === 'critical').length
  const warn = vars.filter((v) => v.severity === 'warning').length
  if (critical === 0 && warn === 0) return 'all healthy'
  const parts: string[] = []
  if (critical) parts.push(`${critical} critical`)
  if (warn) parts.push(`${warn} warning`)
  return parts.join(' · ')
}

function summariseRecent(r: RecentFailures): string {
  const parts: string[] = []
  if (r.emailFailedCount) parts.push(`${r.emailFailedCount} email`)
  if (r.whatsappFailedCount) parts.push(`${r.whatsappFailedCount} whatsapp`)
  if (r.ordersWithEmailFailedCount) parts.push(`${r.ordersWithEmailFailedCount} orders`)
  if (r.openAlertCount) parts.push(`${r.openAlertCount} open alerts`)
  if (parts.length === 0) return 'no failures in window'
  return parts.join(' · ')
}
