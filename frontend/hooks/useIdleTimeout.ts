'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

interface UseIdleTimeoutOptions {
  /** Total idle time in ms before onTimeout fires. */
  idleMs: number
  /** How long the warning is visible before onTimeout (must be < idleMs). */
  warnBeforeMs: number
  /** Called once when the countdown enters the warning window. */
  onWarn?: () => void
  /** Called when the full idle period elapses (auto-signout trigger). */
  onTimeout: () => void
  /** Toggle to disable the timer (e.g., on the login page). */
  enabled?: boolean
}

interface UseIdleTimeoutReturn {
  /** True once the warning countdown is running (idle >= idleMs - warnBeforeMs). */
  warning: boolean
  /** Seconds left until onTimeout fires while `warning` is true; 0 otherwise. */
  secondsLeft: number
  /** Reset the idle timer (call this from a "Stay signed in" button). */
  reset: () => void
}

// User activity we treat as "still there". Kept small on purpose: mouse move,
// keydown, click/tap, and scroll cover 99% of real interaction without the
// cost of listening to every wheel/pointer event. `touchstart` covers mobile.
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const

export function useIdleTimeout({
  idleMs,
  warnBeforeMs,
  onWarn,
  onTimeout,
  enabled = true,
}: UseIdleTimeoutOptions): UseIdleTimeoutReturn {
  const [warning, setWarning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)

  // Refs so the timer callbacks always see the current props without
  // resubscribing every render (which would restart the timer).
  const onWarnRef = useRef(onWarn)
  const onTimeoutRef = useRef(onTimeout)
  useEffect(() => { onWarnRef.current = onWarn }, [onWarn])
  useEffect(() => { onTimeoutRef.current = onTimeout }, [onTimeout])

  const warnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const warningRef = useRef(false)

  const clearAll = useCallback(() => {
    if (warnTimerRef.current) { clearTimeout(warnTimerRef.current); warnTimerRef.current = null }
    if (timeoutTimerRef.current) { clearTimeout(timeoutTimerRef.current); timeoutTimerRef.current = null }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
  }, [])

  const startTimers = useCallback(() => {
    clearAll()
    warningRef.current = false
    setWarning(false)
    setSecondsLeft(0)
    warnTimerRef.current = setTimeout(() => {
      warningRef.current = true
      setWarning(true)
      setSecondsLeft(Math.ceil(warnBeforeMs / 1000))
      onWarnRef.current?.()
      countdownRef.current = setInterval(() => {
        setSecondsLeft((s) => (s > 0 ? s - 1 : 0))
      }, 1000)
    }, idleMs - warnBeforeMs)
    timeoutTimerRef.current = setTimeout(() => {
      clearAll()
      warningRef.current = false
      setWarning(false)
      onTimeoutRef.current()
    }, idleMs)
  }, [clearAll, idleMs, warnBeforeMs])

  const reset = useCallback(() => {
    if (!enabled) return
    startTimers()
  }, [enabled, startTimers])

  useEffect(() => {
    if (!enabled) {
      clearAll()
      setWarning(false)
      setSecondsLeft(0)
      return
    }
    startTimers()
    const onActivity = () => {
      // Ignore activity events while the warning is up: those clicks/keys
      // are meant for the modal ("Stay signed in" / "Sign out"), not to
      // silently reset the timer. The modal owns the reset call.
      if (warningRef.current) return
      startTimers()
    }
    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, onActivity, { passive: true })
    }
    return () => {
      clearAll()
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, onActivity)
      }
    }
  }, [enabled, startTimers, clearAll])

  return { warning, secondsLeft, reset }
}
