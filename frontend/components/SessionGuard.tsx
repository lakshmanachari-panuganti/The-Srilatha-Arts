'use client'
import { useEffect, useRef } from 'react'
import { useUserAuth } from '@/stores/userAuth'
import { useAdminAuth } from '@/stores/adminAuth'
import { apiFetch, setUnauthorizedHandler } from '@/lib/api'
import { clearSessionRecord, isSessionExpired, getSessionRemainingMs } from '@/lib/sessionManager'

// Shape returned by GET /api/auth/me
interface MeResponse {
  user: { role?: string } | null
}

// SessionGuard mounts once (in Providers) and enforces three rules:
//
//  1. Session verification  — on every page load and tab focus, calls
//     /api/auth/me to confirm the server still considers the cookie valid.
//     Stale-localStorage users (browser was closed, cookie is gone) are
//     logged out before the UI can show their name.
//
//  2. Global 401 handler    — any authenticated API call that returns 401
//     (expired JWT mid-session) triggers an immediate client-side logout.
//
//  3. 2-hour absolute timer — mirrors the backend JWT expiresIn='2h'.
//     Fires regardless of activity so the user is visually logged out even
//     on a page with no further API calls after the 2-hour mark.
export default function SessionGuard() {
  const userLogout = useUserAuth((s) => s.logout)
  const setSessionVerified = useUserAuth((s) => s._setSessionVerified)
  const adminLogout = useAdminAuth((s) => s.logout)
  const user = useUserAuth((s) => s.user)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── 1. Session verification ──────────────────────────────────────────────
  useEffect(() => {
    let active = true

    async function verify() {
      const currentUser = useUserAuth.getState().user
      const currentAdmin = useAdminAuth.getState().user

      if (!currentUser && !currentAdmin) {
        // Nothing to verify — mark verified so header renders immediately.
        setSessionVerified(true)
        return
      }

      try {
        const res = await apiFetch<MeResponse>('/auth/me')

        if (!active) return

        const role = res.user?.role

        // Customer session check
        if (currentUser && role !== 'customer') {
          clearSessionRecord()
          useUserAuth.getState().logout()
        } else if (currentUser) {
          // Session confirmed — now safe to hydrate cart / wishlist
          setSessionVerified(true)
          const { useWishlist } = await import('@/stores/wishlist')
          const { useCart } = await import('@/stores/cart')
          useWishlist.getState().hydrateFromServer().catch(() => {})
          useCart.getState().hydrateFromServer({ mergeLocal: false }).catch(() => {})
        }

        // Admin session check (admin JWT has 24 h expiry)
        if (currentAdmin && role !== 'admin' && role !== 'superadmin') {
          useAdminAuth.getState().logout()
        }
      } catch {
        // Network error — keep current session state; user is not logged out
        // on transient connectivity issues. sessionVerified stays false until
        // a successful round-trip.
        if (currentUser) setSessionVerified(true) // don't block UI indefinitely
      }
    }

    verify()

    function onVisibility() {
      if (document.visibilityState === 'visible') verify()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      active = false
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 2. Global 401 handler ────────────────────────────────────────────────
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (useUserAuth.getState().user) {
        clearSessionRecord()
        useUserAuth.getState().logout()
      }
      if (useAdminAuth.getState().user) {
        useAdminAuth.getState().logout()
      }
    })
    return () => setUnauthorizedHandler(null)
  }, []) // register once; logout refs are stable store functions

  // ── 3. 2-hour absolute timer ─────────────────────────────────────────────
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    if (!user) return

    if (isSessionExpired()) {
      // No session start recorded or 2 h already elapsed — force logout now.
      clearSessionRecord()
      userLogout()
      return
    }

    const remaining = getSessionRemainingMs()
    timerRef.current = setTimeout(() => {
      clearSessionRecord()
      userLogout()
    }, remaining)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [user, userLogout])

  return null
}
