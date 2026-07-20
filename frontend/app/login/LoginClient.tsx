'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useUserAuth } from '@/stores/userAuth'
import { useCart } from '@/stores/cart'
import { useWishlist } from '@/stores/wishlist'
import { useToast } from '@/stores/toast'
import { consumePendingIntent, peekPendingIntent, type PendingIntent } from '@/lib/pendingIntent'

/**
 * Replays a queued "add to cart / wishlist" intent after a successful
 * sign-in. The cart/wishlist stores' auth-aware sync handles the server
 * write on the new auth token. Called from every login entry point
 * (Google credential callback, email/password, registration).
 */
function replayPendingIntent(): PendingIntent | null {
  const intent = consumePendingIntent()
  if (!intent) return null
  if (intent.type === 'cart') {
    useCart.getState().add(intent.product, intent.qty ?? 1)
    useToast.getState().show({
      message: `Added "${intent.product.title}" to your cart.`,
      kind: 'success',
    })
  } else if (intent.type === 'wishlist') {
    // Only add if it isn't already there; the post-login server hydrate
    // might race and pull the same item from the wishlist endpoint, in
    // which case toggling would REMOVE it.
    if (!useWishlist.getState().has(intent.product.id)) {
      useWishlist.getState().toggle(intent.product)
    }
    useToast.getState().show({
      message: `Saved "${intent.product.title}" to your wishlist.`,
      kind: 'success',
    })
  }
  return intent
}

// ── Google Identity Services type stubs ───────────────────────
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: GoogleIdConfig) => void
          renderButton: (parent: HTMLElement, opts: GoogleButtonOpts) => void
        }
      }
    }
  }
}
interface GoogleIdConfig {
  client_id: string
  callback: (res: { credential: string }) => void
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
// ─────────────────────────────────────────────────────────────

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ''
type Tab = 'signin' | 'signup'

const inputCls =
  'w-full border border-glass-border rounded-lg px-4 py-3 text-sm text-ivory placeholder:text-ivory-mute focus:outline-none focus:ring-2 focus:ring-lavender/40 focus:border-lavender font-sans'
const labelCls =
  'block text-xs font-medium text-ivory-soft mb-1 font-sans uppercase tracking-wider'

function EyeToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      tabIndex={-1}
      aria-label="Toggle password visibility"
      className="absolute right-3 top-1/2 -translate-y-1/2 text-ivory-mute hover:text-ivory-soft text-base leading-none select-none"
    >
      {show ? '🙈' : '👁️'}
    </button>
  )
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px bg-glass-border" />
      <span className="text-xs text-ivory-mute font-sans tracking-wider uppercase">
        {label}
      </span>
      <div className="flex-1 h-px bg-glass-border" />
    </div>
  )
}

function Spinner({ label }: { label: string }) {
  return (
    <span className="flex items-center justify-center gap-2">
      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
      {label}
    </span>
  )
}

export default function LoginClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { loginWithGoogle, loginWithEmail, register, completeProfile, user, isLoading, error, clearError } =
    useUserAuth()

  const btnRef = useRef<HTMLDivElement>(null)
  const [gsiReady, setGsiReady] = useState(false)
  const [tab, setTab] = useState<Tab>('signin')

  // Sign-in form
  const [si, setSi] = useState({ email: '', password: '' })
  const [siError, setSiError] = useState('')
  const [siShowPw, setSiShowPw] = useState(false)

  // Sign-up form
  const [su, setSu] = useState({ name: '', email: '', password: '', confirm: '', phone: '' })
  const [suError, setSuError] = useState('')
  const [suShowPw, setSuShowPw] = useState(false)
  const [suShowCf, setSuShowCf] = useState(false)

  // Profile-completion modal (Google new users)
  const [showModal, setShowModal] = useState(false)
  const [modal, setModal] = useState({ name: '', phone: '' })
  const [modalError, setModalError] = useState('')
  const [modalBusy, setModalBusy] = useState(false)

  const nextPath = searchParams.get('next') || '/account'

  // Snapshot any queued intent (peek-only) so we can render a contextual
  // banner above the form: "Sign in to add <product> to your cart". The
  // actual consume + replay happens inside the post-auth handlers below.
  const [queuedIntent, setQueuedIntent] = useState<PendingIntent | null>(null)
  useEffect(() => {
    setQueuedIntent(peekPendingIntent())
  }, [])

  useEffect(() => {
    if (user) router.replace(nextPath)
  }, [user, router, nextPath])

  // Load GSI script once
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    if (window.google?.accounts?.id) { setGsiReady(true); return }
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.defer = true
    s.onload = () => setGsiReady(true)
    document.head.appendChild(s)
    return () => { document.head.removeChild(s) }
  }, [])

  // Re-render GSI button when tab changes or script becomes ready
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
      width: 288,
      text: 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'center',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gsiReady, tab])

  async function handleGoogleCredential(res: { credential: string }) {
    clearError()
    const result = await loginWithGoogle(res.credential)
    if (!result) return
    if (result.needsProfileSetup) {
      const stored = useUserAuth.getState().user
      setModal({ name: stored?.name ?? '', phone: '' })
      setShowModal(true)
    } else {
      replayPendingIntent()
      router.replace(nextPath)
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setSiError('')
    clearError()
    if (!si.email.trim() || !si.password) { setSiError('Please enter your email and password.'); return }
    const ok = await loginWithEmail(si.email.trim(), si.password)
    if (ok) {
      replayPendingIntent()
      router.replace(nextPath)
    }
    else setSiError(useUserAuth.getState().error || 'Login failed. Please try again.')
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setSuError('')
    clearError()
    if (!su.name.trim()) return setSuError('Full name is required.')
    if (!su.email.trim()) return setSuError('Email address is required.')
    if (su.password.length < 8) return setSuError('Password must be at least 8 characters.')
    if (su.password !== su.confirm) return setSuError('Passwords do not match.')
    const ok = await register(su.name.trim(), su.email.trim(), su.password, su.phone.trim())
    if (ok) {
      replayPendingIntent()
      router.replace(nextPath)
    }
    else setSuError(useUserAuth.getState().error || 'Registration failed. Please try again.')
  }

  async function handleModalSubmit(e: React.FormEvent) {
    e.preventDefault()
    setModalError('')
    if (!modal.name.trim()) { setModalError('Please enter your full name.'); return }
    setModalBusy(true)
    const ok = await completeProfile(modal.name.trim(), modal.phone.trim())
    setModalBusy(false)
    if (ok) {
      replayPendingIntent()
      router.replace(nextPath)
    }
    else setModalError(useUserAuth.getState().error || 'Failed to save profile. Please try again.')
  }

  if (user) return null

  const switchTab = (t: Tab) => { setTab(t); clearError(); setSiError(''); setSuError('') }

  return (
    <>
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">

        {/* Brand header */}
        <div className="mb-8 text-center">
          <p className="eyebrow justify-center mb-2">Welcome</p>
          <h1 className="font-brand text-5xl text-ivory tracking-[0.04em]">Srilatha Art</h1>
          <p className="mt-2 text-sm text-ivory-soft font-sans">
            Sign in to your account or create a new one
          </p>
        </div>

        {/* Pending-intent banner - tells the user WHY they're on the
            login page and what we'll do once they sign in. Cleared by
            consumePendingIntent() inside the post-auth handlers. */}
        {queuedIntent && (
          <div className="w-full max-w-sm mb-4 rounded-xl border border-lavender/40 bg-lavender-pastel/15 px-4 py-3 text-sm text-ivory">
            <p className="font-medium">Sign in to continue</p>
            <p className="text-ivory-soft mt-0.5">
              We&apos;ll add{' '}
              <span className="font-medium text-ivory">&ldquo;{queuedIntent.product.title}&rdquo;</span>{' '}
              to your {queuedIntent.type === 'cart' ? 'cart' : 'wishlist'} automatically.
            </p>
          </div>
        )}

        {/* Card */}
        <div className="w-full max-w-sm card overflow-hidden">

          {/* Tabs */}
          <div className="flex border-b border-glass-border">
            {(['signin', 'signup'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                className={`flex-1 py-3.5 text-sm font-sans font-medium transition-colors ${
                  tab === t
                    ? 'text-ivory border-b-2 border-lavender -mb-px bg-transparent'
                    : 'text-ivory-mute hover:text-ivory-soft bg-transparent'
                }`}
              >
                {t === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <div className="p-8">

            {/* ── SIGN IN ── */}
            {tab === 'signin' && (
              <div className="space-y-5">

                {GOOGLE_CLIENT_ID && (
                  <>
                    <div className="flex justify-center">
                      <div ref={btnRef} className="min-h-[44px] flex items-center justify-center" />
                    </div>
                    <Divider label="or" />
                  </>
                )}

                <form onSubmit={handleSignIn} noValidate className="space-y-4">
                  <div>
                    <label htmlFor="si-email" className={labelCls}>
                      Email address <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="si-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={si.email}
                      onChange={(e) => setSi((s) => ({ ...s, email: e.target.value }))}
                      placeholder="you@example.com"
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="si-pw" className={labelCls} style={{ marginBottom: 0 }}>
                        Password <span className="text-red-400">*</span>
                      </label>
                      <a
                        href="/forgot-password"
                        className="text-xs text-lavender hover:text-lavender-soft font-sans font-medium underline"
                      >
                        Forgot password?
                      </a>
                    </div>
                    <div className="relative">
                      <input
                        id="si-pw"
                        type={siShowPw ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        value={si.password}
                        onChange={(e) => setSi((s) => ({ ...s, password: e.target.value }))}
                        placeholder="••••••••"
                        className={inputCls}
                      />
                      <EyeToggle show={siShowPw} onToggle={() => setSiShowPw((v) => !v)} />
                    </div>
                  </div>

                  {(siError || error) && (
                    <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 text-center">
                      {siError || error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="btn-dark w-full disabled:opacity-60"
                  >
                    {isLoading ? <Spinner label="Signing in…" /> : 'Sign in'}
                  </button>
                </form>

                <p className="text-xs text-center text-ivory-mute font-sans">
                  Don&apos;t have an account?{' '}
                  <button
                    onClick={() => switchTab('signup')}
                    className="text-lavender hover:text-lavender-soft font-medium underline"
                  >
                    Create one
                  </button>
                </p>
              </div>
            )}

            {/* ── SIGN UP ── */}
            {tab === 'signup' && (
              <form onSubmit={handleSignUp} noValidate className="space-y-4">

                <div>
                  <label htmlFor="su-name" className={labelCls}>
                    Full name <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="su-name"
                    type="text"
                    required
                    autoFocus
                    autoComplete="name"
                    value={su.name}
                    onChange={(e) => setSu((s) => ({ ...s, name: e.target.value }))}
                    placeholder="Albert Einstein"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label htmlFor="su-email" className={labelCls}>
                    Email address <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="su-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={su.email}
                    onChange={(e) => setSu((s) => ({ ...s, email: e.target.value }))}
                    placeholder="you@example.com"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label htmlFor="su-pw" className={labelCls}>
                    Password <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="su-pw"
                      type={suShowPw ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      value={su.password}
                      onChange={(e) => setSu((s) => ({ ...s, password: e.target.value }))}
                      placeholder="Min. 8 characters"
                      className={inputCls}
                    />
                    <EyeToggle show={suShowPw} onToggle={() => setSuShowPw((v) => !v)} />
                  </div>
                </div>

                <div>
                  <label htmlFor="su-cf" className={labelCls}>
                    Confirm password <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="su-cf"
                      type={suShowCf ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      value={su.confirm}
                      onChange={(e) => setSu((s) => ({ ...s, confirm: e.target.value }))}
                      placeholder="Repeat password"
                      className={inputCls}
                    />
                    <EyeToggle show={suShowCf} onToggle={() => setSuShowCf((v) => !v)} />
                  </div>
                </div>

                <div>
                  <label htmlFor="su-phone" className={labelCls}>
                    Mobile number{' '}
                    <span className="text-ivory-mute font-normal normal-case">(optional)</span>
                  </label>
                  <input
                    id="su-phone"
                    type="tel"
                    autoComplete="tel"
                    value={su.phone}
                    onChange={(e) => setSu((s) => ({ ...s, phone: e.target.value }))}
                    placeholder="+91 98765 43210"
                    className={inputCls}
                  />
                </div>

                {(suError || error) && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 text-center">
                    {suError || error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-dark w-full disabled:opacity-60"
                >
                  {isLoading ? <Spinner label="Creating account…" /> : 'Create account'}
                </button>

                {GOOGLE_CLIENT_ID && (
                  <>
                    <Divider label="or sign up with" />
                    <div className="flex justify-center">
                      <div ref={btnRef} className="min-h-[44px] flex items-center justify-center" />
                    </div>
                  </>
                )}

                <p className="text-xs text-center text-ivory-mute font-sans">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchTab('signin')}
                    className="text-lavender hover:text-lavender-soft font-medium underline"
                  >
                    Sign in
                  </button>
                </p>
              </form>
            )}

            <p className="mt-6 text-xs text-center text-ivory-mute font-sans leading-relaxed">
              By signing in you agree to our{' '}
              <a href="/terms" className="underline hover:text-ivory-soft">Terms</a>{' '}
              and{' '}
              <a href="/privacy-policy" className="underline hover:text-ivory-soft">Privacy policy</a>.
            </p>
          </div>
        </div>
      </div>

      {/* ── Profile completion modal (Google new users) ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div className="w-full max-w-md card p-8">
            <div className="mb-6 text-center">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-lavender-light flex items-center justify-center text-2xl">
                👋
              </div>
              <h2 id="modal-title" className="font-serif text-2xl font-semibold text-ivory">
                One last step
              </h2>
              <p className="mt-1 text-sm text-ivory-soft font-sans">
                Tell us your name so we can address you properly.
              </p>
            </div>

            <form onSubmit={handleModalSubmit} noValidate className="space-y-4">
              <div>
                <label htmlFor="modal-name" className={labelCls}>
                  Full name <span className="text-red-400">*</span>
                </label>
                <input
                  id="modal-name"
                  type="text"
                  required
                  autoFocus
                  value={modal.name}
                  onChange={(e) => setModal((m) => ({ ...m, name: e.target.value }))}
                  placeholder="Your full name"
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="modal-phone" className={labelCls}>
                  Mobile number{' '}
                  <span className="text-ivory-mute font-normal normal-case">(optional)</span>
                </label>
                <input
                  id="modal-phone"
                  type="tel"
                  value={modal.phone}
                  onChange={(e) => setModal((m) => ({ ...m, phone: e.target.value }))}
                  placeholder="+91 98765 43210"
                  className={inputCls}
                />
              </div>

              {modalError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 text-center">
                  {modalError}
                </p>
              )}

              <button
                type="submit"
                disabled={modalBusy}
                className="btn-dark w-full disabled:opacity-60 mt-2"
              >
                {modalBusy ? <Spinner label="Saving…" /> : 'Continue to my account'}
              </button>

              <button
                type="button"
                onClick={() => { setShowModal(false); router.replace(nextPath) }}
                className="w-full text-xs text-ivory-mute hover:text-ivory-soft py-1 font-sans"
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
