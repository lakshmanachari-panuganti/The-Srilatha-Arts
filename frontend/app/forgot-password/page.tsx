'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiFetch, ApiError } from '@/lib/api'

type Step = 'email' | 'verify' | 'done'

const inputCls =
  'w-full border border-glass-border rounded-lg px-4 py-3 text-sm text-ivory placeholder:text-ivory-mute bg-[var(--bg-input)] focus:outline-none focus:ring-2 focus:ring-lavender/40 focus:border-lavender font-sans'
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

function Spinner({ label }: { label: string }) {
  return (
    <span className="flex items-center justify-center gap-2">
      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
      {label}
    </span>
  )
}

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Step 1
  const [email, setEmail] = useState('')
  const [maskedPhone, setMaskedPhone] = useState('')
  const [maskedEmail, setMaskedEmail] = useState('')
  const [sentChannels, setSentChannels] = useState<string[]>([])

  // Step 2
  const [otp, setOtp] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email.trim()) { setError('Please enter your email address.'); return }

    setBusy(true)
    try {
      const res = await apiFetch<{ message: string; channels?: string[]; email?: string; phone?: string }>('/auth/forgot-password', {
        method: 'POST',
        body: { email: email.trim() },
      })
      setMaskedEmail(res.email ?? '')
      setMaskedPhone(res.phone ?? '')
      setSentChannels(res.channels ?? ['email'])
      setStep('verify')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!otp.trim()) { setError('Please enter the verification code.'); return }
    if (newPw.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (newPw !== confirmPw) { setError('Passwords do not match.'); return }

    setBusy(true)
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: { email: email.trim(), otp: otp.trim(), newPassword: newPw },
      })
      setStep('done')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <p className="eyebrow justify-center mb-2">Account</p>
        <h1 className="font-brand text-5xl text-ivory tracking-[0.04em]">Srilatha Art</h1>
        <p className="mt-2 text-sm text-ivory-soft font-sans">
          {step === 'done' ? 'Password updated' : 'Reset your password'}
        </p>
      </div>

      <div className="w-full max-w-sm card overflow-hidden p-8 space-y-5">

        {/* ── Step 1: Email ── */}
        {step === 'email' && (
          <>
            <p className="text-sm text-ivory-soft font-sans leading-relaxed">
              Enter your email address and we&apos;ll send a 6-digit verification code to your registered WhatsApp number.
            </p>

            <form onSubmit={handleRequestCode} noValidate className="space-y-4">
              <div>
                <label htmlFor="fp-email" className={labelCls}>
                  Email address <span className="text-red-400">*</span>
                </label>
                <input
                  id="fp-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputCls}
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 text-center">
                  {error}
                </p>
              )}

              <button type="submit" disabled={busy} className="btn-dark w-full disabled:opacity-60">
                {busy ? <Spinner label="Sending code…" /> : 'Send Code'}
              </button>
            </form>

            <p className="text-xs text-center text-ivory-mute font-sans">
              <Link href="/login" className="text-lavender hover:text-lavender-soft font-medium underline">
                Back to Sign in
              </Link>
            </p>
          </>
        )}

        {/* ── Step 2: OTP + New Password ── */}
        {step === 'verify' && (
          <>
            <div className="rounded-lg bg-lavender/10 border border-lavender/30 px-4 py-3 text-sm text-ivory-soft font-sans leading-relaxed">
              {maskedEmail ? (
                <>
                  OTP has been sent to
                  {sentChannels.includes('email') && (
                    <> email <span className="font-medium text-ivory">{maskedEmail}</span></>
                  )}
                  {sentChannels.includes('email') && sentChannels.includes('whatsapp') && ' & '}
                  {sentChannels.includes('whatsapp') && maskedPhone && (
                    <span className="font-medium text-ivory"> {maskedPhone}</span>
                  )}
                  . It expires in 10 minutes.
                </>
              ) : (
                <>If an account is registered with this email, a verification code has been sent. It expires in 10 minutes.</>
              )}
            </div>

            <form onSubmit={handleReset} noValidate className="space-y-4">
              <div>
                <label htmlFor="fp-otp" className={labelCls}>
                  Verification code <span className="text-red-400">*</span>
                </label>
                <input
                  id="fp-otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="fp-new-pw" className={labelCls}>
                  New password <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    id="fp-new-pw"
                    type={showNewPw ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder="At least 8 characters"
                    className={inputCls}
                  />
                  <EyeToggle show={showNewPw} onToggle={() => setShowNewPw((v) => !v)} />
                </div>
              </div>

              <div>
                <label htmlFor="fp-confirm-pw" className={labelCls}>
                  Confirm new password <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    id="fp-confirm-pw"
                    type={showConfirmPw ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    placeholder="••••••••"
                    className={inputCls}
                  />
                  <EyeToggle show={showConfirmPw} onToggle={() => setShowConfirmPw((v) => !v)} />
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 text-center">
                  {error}
                </p>
              )}

              <button type="submit" disabled={busy} className="btn-dark w-full disabled:opacity-60">
                {busy ? <Spinner label="Resetting password…" /> : 'Reset Password'}
              </button>
            </form>

            <div className="flex justify-between text-xs text-ivory-mute font-sans">
              <button
                type="button"
                onClick={() => { setStep('email'); setError(''); setOtp(''); setNewPw(''); setConfirmPw(''); setSentChannels([]); setMaskedEmail(''); setMaskedPhone('') }}
                className="text-lavender hover:text-lavender-soft font-medium underline"
              >
                Resend code
              </button>
              <Link href="/login" className="text-lavender hover:text-lavender-soft font-medium underline">
                Back to Sign in
              </Link>
            </div>
          </>
        )}

        {/* ── Step 3: Done ── */}
        {step === 'done' && (
          <>
            <div className="text-center space-y-3">
              <div className="text-4xl">✅</div>
              <p className="text-sm text-ivory-soft font-sans leading-relaxed">
                Your password has been updated. You can now sign in with your new password.
              </p>
            </div>

            <button
              type="button"
              onClick={() => router.push('/login')}
              className="btn-dark w-full"
            >
              Sign in
            </button>
          </>
        )}
      </div>
    </div>
  )
}
