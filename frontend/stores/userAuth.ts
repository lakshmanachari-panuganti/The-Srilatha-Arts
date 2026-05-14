import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiFetch, ApiError, setApiAuthToken } from '@/lib/api'

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
          return { needsProfileSetup: res.needsProfileSetup }
        } catch (err) {
          const message = extractErrorMessage(err)
          set({ isLoading: false, error: message })
          return null
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
      },

      clearError: () => set({ error: null }),

      _setUser: (user: AuthUser, token: string) => {
        setApiAuthToken(token)
        set({ user, token, needsProfileSetup: false })
      },
    }),
    {
      name: 'tsa-user-auth',
      partialize: (s) => ({ user: s.user, token: s.token }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          setApiAuthToken(state.token)
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
