'use client'

/**
 * usePinLookup - debounced Indian PIN code → city + state lookup.
 *
 * The hook owns three concerns the checkout form would otherwise duplicate:
 *
 *   1. Debounce. We only fire the API call ~350ms after the user stops
 *      typing, so a customer thumb-typing the PIN doesn't fan out six
 *      requests as they reach the sixth digit.
 *
 *   2. Validation. We only query for exactly-6-digit input. Anything else
 *      resets state silently - no spurious "error" while the customer is
 *      mid-typing.
 *
 *   3. Caching + cancellation. A module-level Map de-duplicates lookups
 *      across mount/unmount cycles within the session (saved address vs.
 *      manual entry, edit form vs. checkout form). AbortController cancels
 *      a stale request when the PIN changes.
 *
 * The hook deliberately does NOT auto-fill form fields itself - the caller
 * decides when to apply the resolved `data` to their form state. This keeps
 * the hook composable across the main shipping form, the saved-address
 * edit dialog, and any future surface (cart estimate, custom-order intake).
 *
 * Usage:
 *   const { loading, data, error } = usePinLookup(form.pincode)
 *   useEffect(() => {
 *     if (data) setForm((f) => ({ ...f, city: data.city, state: data.state }))
 *   }, [data])
 */

import { useEffect, useRef, useState } from 'react'
import { apiFetch, ApiError } from '@/lib/api'

export interface PinLookupResult {
  pincode: string
  city: string
  district: string
  state: string
  country: string
}

interface PinLookupState {
  loading: boolean
  data: PinLookupResult | null
  /** User-facing message when lookup fails. Null while idle / loading.
   *  'not_found' for a real 404, 'unavailable' for upstream / network. */
  error: 'not_found' | 'unavailable' | null
}

const DEBOUNCE_MS = 350

// Module-level cache. PIN-to-city mappings are stable enough that a session
// cache pays for itself within the first few keystrokes. The cache also
// stores `null` for not-found PINs so we don't re-query them.
const cache = new Map<string, PinLookupResult | null>()

export function usePinLookup(pincode: string): PinLookupState {
  const [state, setState] = useState<PinLookupState>({
    loading: false,
    data: null,
    error: null,
  })
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    // Cancel any in-flight request from a previous value.
    abortRef.current?.abort()

    const trimmed = pincode.trim()

    if (!/^\d{6}$/.test(trimmed)) {
      // Invalid / incomplete - quiet reset, no error surfaced.
      setState({ loading: false, data: null, error: null })
      return
    }

    // Cache hit (positive or negative)
    if (cache.has(trimmed)) {
      const cached = cache.get(trimmed)!
      setState({
        loading: false,
        data: cached,
        error: cached === null ? 'not_found' : null,
      })
      return
    }

    const ctrl = new AbortController()
    abortRef.current = ctrl

    const timer = setTimeout(async () => {
      setState({ loading: true, data: null, error: null })
      try {
        const result = await apiFetch<PinLookupResult>(
          `/pincode/${encodeURIComponent(trimmed)}`,
          { signal: ctrl.signal },
        )
        cache.set(trimmed, result)
        setState({ loading: false, data: result, error: null })
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return
        if (err instanceof ApiError && err.status === 404) {
          cache.set(trimmed, null)
          setState({ loading: false, data: null, error: 'not_found' })
          return
        }
        setState({ loading: false, data: null, error: 'unavailable' })
      }
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [pincode])

  return state
}
