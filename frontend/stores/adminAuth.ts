import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiFetch, ApiError, setApiAuthToken } from '@/lib/api'
import { getCaptchaToken } from '@/lib/captcha'

interface AdminUser {
  username: string
  name: string
  role: 'admin' | 'superadmin'
}

interface AdminAuthState {
  user: AdminUser | null
  token: string | null
  isLoading: boolean
  error: string | null

  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  clearError: () => void
}

export const useAdminAuth = create<AdminAuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoading: false,
      error: null,

      login: async (username: string, password: string) => {
        set({ isLoading: true, error: null })
        try {
          const captchaToken = await getCaptchaToken('admin_login')
          const res = await apiFetch<{ user: AdminUser; token: string }>(
            '/auth/admin/login',
            {
              method: 'POST',
              body: { username, password, captchaToken },
            },
          )
          set({ user: res.user, token: res.token, isLoading: false, error: null })
          setApiAuthToken(res.token, 'admin')
          return true
        } catch (err) {
          let message: string

          if (err instanceof ApiError) {
            // Backend responded with a structured error - surface its message
            message =
              err.body && typeof err.body === 'object' && 'error' in err.body
                ? String((err.body as { error: string }).error)
                : err.message
          } else if (
            err instanceof TypeError &&
            /fetch|network/i.test(err.message)
          ) {
            // CORS block, DNS failure, or backend unreachable all surface as TypeError
            message =
              'Unable to reach the server. This may be a network issue or a CORS configuration problem. Please check your connection and try again.'
          } else {
            message = 'An unexpected error occurred. Please try again.'
          }

          set({ isLoading: false, error: message })
          return false
        }
      },

      logout: () => {
        set({ user: null, token: null, error: null })
        setApiAuthToken(null, 'admin')
        // Clear the httpOnly tsa_token cookie server-side.
        // Fire-and-forget: the UI is already cleared; if this fails the cookie
        // expires naturally after 24 h and the next API call returns 401.
        apiFetch('/auth/admin/logout', { method: 'POST' }).catch(() => {
          // Intentionally ignored - local state is authoritative for the guard.
        })
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'tsa-admin-auth',
      partialize: (state) => ({ user: state.user, token: state.token }),
      onRehydrateStorage: () => (state) => {
        // Restore the token into apiFetch after a page refresh. Scope to
        // the admin slot so a concurrent userAuth rehydration cannot
        // overwrite it (and vice versa).
        if (state?.token) setApiAuthToken(state.token, 'admin')
      },
    },
  ),
)
