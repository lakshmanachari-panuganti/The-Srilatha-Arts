import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiFetch, ApiError } from '@/lib/api'

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
          const res = await apiFetch<{ user: AdminUser; token: string }>(
            '/auth/admin/login',
            {
              method: 'POST',
              body: { username, password },
            },
          )
          set({ user: res.user, token: res.token, isLoading: false, error: null })
          return true
        } catch (err) {
          let message: string

          if (err instanceof ApiError) {
            // Backend responded with a structured error — surface its message
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
        // Also clear the httpOnly cookie by calling a logout endpoint if available,
        // but since we store the token client-side too, clearing state is sufficient
        // for the frontend guard.
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'tsa-admin-auth',
      partialize: (state) => ({ user: state.user, token: state.token }),
    },
  ),
)
