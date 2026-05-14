'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { useUserAuth } from '@/stores/userAuth'

// ---------- Google Identity Services type stubs ----------
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: GoogleIdConfig) => void
          renderButton: (parent: HTMLElement, opts: GoogleButtonOpts) => void
          prompt: () => void
        }
      }
    }
  }
}
interface GoogleIdConfig {
  client_id: string
  callback: (res: { credential: string }) => void
  auto_select?: boolean
  cancel_on_tap_outside?: boolean
}
interface GoogleButtonOpts {
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'large' | 'medium' | 'small'
  width?: number
  text?: string
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'
  logo_alignment?: 'left' | 'center'
}
// ---------------------------------------------------------

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ''

export default function LoginClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { loginWithGoogle, completeProfile, user, isLoading, error, clearError } = useUserAuth()

  const btnRef = useRef<HTMLDivElement>(null)
  const [gsiReady, setGsiReady] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '' })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      const next = searchParams.get('next') || '/account'
      router.replace(next)
    }
  }, [user, router, searchParams])

  // Load Google Identity Services script
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    if (window.google?.accounts?.id) {
      setGsiReady(true)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => setGsiReady(true)
    document.head.appendChild(script)
    return () => {
      document.head.removeChild(script)
    }
  }, [])

  // Initialize GSI and render button once script is ready
  useEffect(() => {
    if (!gsiReady || !btnRef.current || !GOOGLE_CLIENT_ID) return
    window.google!.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
      cancel_on_tap_outside: true,
    })
    window.google!.accounts.id.renderButton(btnRef.current, {
      theme: 'outline',
      size: 'large',
      width: 320,
      text: 'signin_with',
      shape: 'rectangular',
      logo_alignment: 'center',
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gsiReady])

  async function handleGoogleCredential(response: { credential: string }) {
    clearError()
    const result = await loginWithGoogle(response.credential)
    if (!result) return // error already set in store

    if (result.needsProfileSetup) {
      // Pre-fill name from store (Google gives us a name)
      const storeUser = useUserAuth.getState().user
      setForm({ name: storeUser?.name ?? '', phone: '' })
      setShowModal(true)
    } else {
      const next = searchParams.get('next') || '/account'
      router.replace(next)
    }
  }

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    if (!form.name.trim()) {
      setFormError('Please enter your full name.')
      return
    }
    setSubmitting(true)
    const ok = await completeProfile(form.name.trim(), form.phone.trim())
    setSubmitting(false)
    if (ok) {
      const next = searchParams.get('next') || '/account'
      router.replace(next)
    } else {
      setFormError(useUserAuth.getState().error || 'Failed to save profile. Please try again.')
    }
  }

  if (user) return null // waiting for redirect

  return (
    <>
      {/* ── Main login card ── */}
      <div className="min-h-screen bg-[#faf9f7] flex flex-col items-center justify-center px-4 py-16">
        {/* Logo / brand */}
        <div className="mb-8 text-center">
          <p className="font-[var(--font-montserrat)] text-xs uppercase tracking-[0.2em] text-[#8b7355] mb-2">
            Welcome to
          </p>
          <h1 className="font-[var(--font-playfair)] text-3xl font-semibold text-[#2c1810]">
            The Srilatha Arts
          </h1>
          <p className="mt-2 text-sm text-[#8b7355] font-[var(--font-montserrat)]">
            Sign in to explore handcrafted art
          </p>
        </div>

        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-[#e8e0d5] p-8">
          {/* Decorative divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-[#e8e0d5]" />
            <span className="text-xs text-[#b8a99a] font-[var(--font-montserrat)] tracking-wider uppercase">
              Continue with
            </span>
            <div className="flex-1 h-px bg-[#e8e0d5]" />
          </div>

          {/* Google button container */}
          <div className="flex justify-center">
            {GOOGLE_CLIENT_ID ? (
              <div ref={btnRef} className="min-h-[44px] flex items-center justify-center" />
            ) : (
              <div className="text-sm text-red-500 text-center">
                Google Sign-In is not configured.<br />
                Contact support.
              </div>
            )}
          </div>

          {/* API / network error */}
          {error && (
            <p className="mt-4 text-sm text-red-600 text-center bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="mt-4 flex justify-center">
              <div className="w-5 h-5 border-2 border-[#c9a96e] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          <p className="mt-6 text-xs text-center text-[#b8a99a] font-[var(--font-montserrat)] leading-relaxed">
            By signing in you agree to our{' '}
            <a href="/terms" className="underline hover:text-[#8b7355]">Terms</a>{' '}
            and{' '}
            <a href="/privacy-policy" className="underline hover:text-[#8b7355]">Privacy Policy</a>.
          </p>
        </div>
      </div>

      {/* ── Profile completion modal ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
            <div className="mb-6 text-center">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-[#fdf6ec] flex items-center justify-center text-2xl">
                👋
              </div>
              <h2
                id="modal-title"
                className="font-[var(--font-playfair)] text-2xl font-semibold text-[#2c1810]"
              >
                Almost there!
              </h2>
              <p className="mt-1 text-sm text-[#8b7355] font-[var(--font-montserrat)]">
                Tell us your name so we can personalise your experience.
              </p>
            </div>

            <form onSubmit={handleProfileSubmit} noValidate className="space-y-4">
              {/* Full name */}
              <div>
                <label
                  htmlFor="fullName"
                  className="block text-xs font-medium text-[#5c4a3a] mb-1 font-[var(--font-montserrat)] uppercase tracking-wider"
                >
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  id="fullName"
                  type="text"
                  required
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Your full name"
                  className="w-full border border-[#d4c9bb] rounded-lg px-4 py-3 text-sm text-[#2c1810] placeholder:text-[#b8a99a] focus:outline-none focus:ring-2 focus:ring-[#c9a96e]/40 focus:border-[#c9a96e] font-[var(--font-montserrat)]"
                />
              </div>

              {/* Mobile number */}
              <div>
                <label
                  htmlFor="phone"
                  className="block text-xs font-medium text-[#5c4a3a] mb-1 font-[var(--font-montserrat)] uppercase tracking-wider"
                >
                  Mobile Number{' '}
                  <span className="text-[#b8a99a] font-normal normal-case">(optional)</span>
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+91 98765 43210"
                  className="w-full border border-[#d4c9bb] rounded-lg px-4 py-3 text-sm text-[#2c1810] placeholder:text-[#b8a99a] focus:outline-none focus:ring-2 focus:ring-[#c9a96e]/40 focus:border-[#c9a96e] font-[var(--font-montserrat)]"
                />
              </div>

              {formError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 text-center">
                  {formError}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#c9a96e] hover:bg-[#b8965a] disabled:opacity-60 text-white font-[var(--font-montserrat)] font-semibold text-sm tracking-wide py-3 rounded-lg transition-colors mt-2"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Saving…
                  </span>
                ) : (
                  'Continue to my account'
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowModal(false)
                  const next = searchParams.get('next') || '/account'
                  router.replace(next)
                }}
                className="w-full text-xs text-[#b8a99a] hover:text-[#8b7355] py-1 font-[var(--font-montserrat)]"
              >
                Skip for now
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
