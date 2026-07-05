import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiFetch, ApiError, setApiAuthToken } from '@/lib/api'
import { useWishlist } from '@/stores/wishlist'
import { useCart } from '@/stores/cart'

// Side-effect runner - pulls the server cart + wishlist after auth state
// is known so the user sees their cross-device saved pieces immediately.
// Best-effort: network failures don't block sign-in.
// `mergeLocal` is true ONLY for the anonymous→login transition - on page
// reload it must be false, otherwise the cart's local items (just rehydrated
// from localStorage) get re-POSTed and the server increments them again.
function syncUserDataAfterAuth(opts?: { mergeLocal?: boolean }) {
  const mergeLocal = opts?.mergeLocal === true
  // Defer to next tick so the auth token is in place before the GETs fire.
  setTimeout(() => {
    useWishlist.getState().hydrateFromServer().catch(() => {})
    useCart.getState().hydrateFromServer({ mergeLocal }).catch(() => {})
  }, 0)
}

export interface AuthUser {
  email: string
  name: string
  phone?: string
  picture?: string
  role: 'customer'
}

interface UserAuthState {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  error: string | null
  needsProfileSetup: boolean

  loginWithGoogle: (credential: string) => Promise<{ needsProfileSetup: boolean } | null>
  loginWithEmail: (email: string, password: string) => Promise<boolean>
  register: (name: string, email: string, password: string, phone: string) => Promise<boolean>
  completeProfile: (name: string, phone: string) => Promise<boolean>
  logout: () => Promise<void>
  clearError: () => void
  _setUser: (user: AuthUser, token: string) => void
}

export const useUserAuth = create<UserAuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      error: null,
      needsProfileSetup: false,

      loginWithGoogle: async (credential: string) => {
        set({ isLoading: true, error: null })
        try {
          const res = await apiFetch<{
            user: AuthUser
            token: string
            needsProfileSetup: boolean
          }>('/auth/google', {
            method: 'POST',
            body: { credential },
          })
          setApiAuthToken(res.token)
          set({
            user: res.user,
            token: res.token,
            needsProfileSetup: res.needsProfileSetup,
            isLoading: false,
            error: null,
          })
          syncUserDataAfterAuth({ mergeLocal: true })
          return { needsProfileSetup: res.needsProfileSetup }
        } catch (err) {
          const message = extractErrorMessage(err)
          set({ isLoading: false, error: message })
          return null
        }
      },

      loginWithEmail: async (email: string, password: string) => {
        set({ isLoading: true, error: null })
        try {
          const res = await apiFetch<{ user: AuthUser; token: string }>('/auth/login', {
            method: 'POST',
            body: { email, password },
          })
          setApiAuthToken(res.token)
          set({ user: res.user, token: res.token, isLoading: false, error: null })
          syncUserDataAfterAuth({ mergeLocal: true })
          return true
        } catch (err) {
          set({ isLoading: false, error: extractErrorMessage(err) })
          return false
        }
      },

      register: async (name: string, email: string, password: string, phone: string) => {
        set({ isLoading: true, error: null })
        try {
          const res = await apiFetch<{ user: AuthUser; token: string }>('/auth/register', {
            method: 'POST',
            body: { name, email, password, phone: phone || undefined },
          })
          setApiAuthToken(res.token)
          set({ user: res.user, token: res.token, isLoading: false, error: null })
          syncUserDataAfterAuth({ mergeLocal: true })
          return true
        } catch (err) {
          set({ isLoading: false, error: extractErrorMessage(err) })
          return false
        }
      },

      completeProfile: async (name: string, phone: string) => {
        set({ isLoading: true, error: null })
        try {
          const res = await apiFetch<{ user: AuthUser }>('/auth/profile', {
            method: 'PATCH',
            body: { name, phone },
          })
          set({
            user: res.user,
            needsProfileSetup: false,
            isLoading: false,
            error: null,
          })
          return true
        } catch (err) {
          const message = extractErrorMessage(err)
          set({ isLoading: false, error: message })
          return false
        }
      },

      logout: async () => {
        try {
          await apiFetch('/auth/logout', { method: 'POST' })
        } catch {
          // best-effort
        }
        setApiAuthToken(null)
        set({ user: null, token: null, needsProfileSetup: false, error: null })
        // Clear local cart + wishlist so the next user on the same browser
        // doesn't inherit the previous user's items. Spec: "When a user
        // signs out, the Cart and Wishlist UI should be cleared
        // immediately." Server-side data for THIS user is preserved -
        // a fresh login for the same user restores their state.
        // Note: cart.clear() also fires DELETE /api/cart, but the auth
        // token has been removed above so that call 401s and is silenced.
        useWishlist.getState().clear()
        useCart.getState().clear()
      },

      clearError: () => set({ error: null }),

      _setUser: (user: AuthUser, token: string) => {
        setApiAuthToken(token)
        set({ user, token, needsProfileSetup: false })
      },
    }),
    {
      name: 'tsa-user-auth',
      // Only persist non-secret identity. The JWT itself is delivered as a
      // cross-site HttpOnly cookie (`tsa_token`) issued by the backend, so
      // apiFetch's `credentials: 'include'` re-authenticates every request
      // without any JS-readable token. Storing the JWT here previously
      // meant any XSS could exfiltrate it — see security audit item C1.
      partialize: (s) => ({ user: s.user }),
      onRehydrateStorage: () => (state) => {
        if (state?.user) {
          // After page reload, pull the latest server wishlist for the
          // restored session so the heart icons reflect cross-device state.
          // The auth cookie carries the session; no in-memory token needed.
          syncUserDataAfterAuth()
        }
      },
    },
  ),
)

function extractErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return err.body && typeof err.body === 'object' && 'error' in err.body
      ? String((err.body as { error: string }).error)
      : err.message
  }
  if (err instanceof TypeError && /fetch|network/i.test(err.message)) {
    return 'Unable to reach the server. Please check your connection and try again.'
  }
  return 'An unexpected error occurred. Please try again.'
}
