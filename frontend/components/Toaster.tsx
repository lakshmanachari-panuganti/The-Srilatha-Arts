'use client'
import { useToast } from '@/stores/toast'
import { CheckCircle2, Info, AlertCircle, X } from 'lucide-react'

// Top-right stack of toasts. Mounted once in ConditionalLayout so it's
// visible on every customer-facing route (admin/auth/checkout included —
// flash messages there are still useful, e.g. session expired). Single
// instance avoids the duplicate-portal problem you'd get if every page
// owned its own root.
export default function Toaster() {
  const toasts = useToast((s) => s.toasts)
  const dismiss = useToast((s) => s.dismiss)
  if (toasts.length === 0) return null

  return (
    <div
      role="region"
      aria-label="Notifications"
      className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none max-w-[calc(100vw-2rem)]"
    >
      {toasts.map((t) => {
        const Icon = t.kind === 'success' ? CheckCircle2 : t.kind === 'error' ? AlertCircle : Info
        const palette =
          t.kind === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : t.kind === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-white/95 border-glass-border text-ivory'
        return (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto rounded-xl px-4 py-3 border shadow-lg backdrop-blur-sm text-sm flex items-start gap-2.5 w-80 ${palette}`}
          >
            <Icon className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
            <p className="flex-1 leading-snug">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="shrink-0 -mr-1 -mt-0.5 opacity-60 hover:opacity-100"
            >
              <X className="w-3.5 h-3.5" aria-hidden />
            </button>
          </div>
        )
      })}
    </div>
  )
}
