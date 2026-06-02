'use client'
import { create } from 'zustand'

// Minimal toast store. There was no global notification system before;
// the existing pattern was inline error text inside each component, which
// doesn't work for cross-page flows like "you're not logged in, redirecting…"
// (the page unmounts before the inline error can be read).

export type ToastKind = 'info' | 'success' | 'error'

export interface Toast {
  id: string
  message: string
  kind: ToastKind
  /** Auto-dismiss after this many ms. 0 = sticky (caller dismisses). */
  durationMs: number
}

interface ToastState {
  toasts: Toast[]
  show: (toast: { message: string; kind?: ToastKind; durationMs?: number }) => string
  dismiss: (id: string) => void
}

const DEFAULT_DURATION_MS = 3500

export const useToast = create<ToastState>((set) => ({
  toasts: [],
  show: ({ message, kind = 'info', durationMs = DEFAULT_DURATION_MS }) => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const toast: Toast = { id, message, kind, durationMs }
    set((s) => ({ toasts: [...s.toasts, toast] }))
    if (durationMs > 0) {
      // Auto-dismiss. We use a plain setTimeout instead of useEffect on the
      // render component so the timeout survives a page navigation - the
      // toast announcing "redirecting…" needs to keep counting down as the
      // user lands on the next route.
      if (typeof window !== 'undefined') {
        window.setTimeout(() => {
          set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
        }, durationMs)
      }
    }
    return id
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
