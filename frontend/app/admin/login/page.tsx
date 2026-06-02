'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Lock, AlertCircle, Loader2 } from 'lucide-react'
import { useAdminAuth } from '@/stores/adminAuth'

export default function AdminLoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login, isLoading, error, clearError } = useAdminAuth()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const success = await login(username, password)
    if (success) {
      // Only honour `next` if it points inside /admin - never accept an
      // arbitrary URL (open-redirect class). The leading-slash check rules
      // out protocol-relative URLs like //evil.com.
      const next = searchParams.get('next') || ''
      const safe = next.startsWith('/admin') && !next.startsWith('//')
      router.replace(safe ? next : '/admin')
    }
  }

  return (
    <div className="min-h-screen bg-plum flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-lavender-pastel/40 to-transparent" />
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-plum-warm/10 rounded-full blur-3xl" />
      <div className="absolute top-1/2 -left-32 w-80 h-80 bg-lavender/20 rounded-full blur-3xl" />

      <main className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center justify-center gap-3 mb-2">
            <Image
              src="/Logos/logo.png"
              alt="Srilatha Art"
              width={64}
              height={64}
              priority
              className="w-16 h-16 object-contain drop-shadow-[0_0_12px_rgba(138,116,201,0.25)]"
            />
            <span className="font-brand text-5xl text-ink tracking-[0.04em]">
              Srilatha Art
            </span>
          </Link>
          <p className="text-sm font-medium tracking-wider uppercase text-ink-mute">Admin Portal</p>
        </div>

        <div className="card-cream p-8 md:p-10 shadow-xl shadow-ink/5">
          <div className="flex items-center gap-3 text-ink mb-6">
            <Lock className="w-5 h-5 text-lavender" />
            <h1 className="font-serif text-2xl">Secure Login</h1>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 mb-5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-ink-soft mb-1.5" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); clearError() }}
                required
                autoComplete="username"
                className="w-full h-11 px-4 bg-plum-light border border-ink/10 rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent transition-all"
                placeholder="admin"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-soft mb-1.5" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); clearError() }}
                required
                autoComplete="current-password"
                className="w-full h-11 px-4 bg-plum-light border border-ink/10 rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent transition-all"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !username || !password}
              className="btn-dark w-full justify-center h-12 mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Access Workspace
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-ink-mute mt-8">
          Protected by Srilatha Art Platform Security
        </p>
      </main>
    </div>
  )
}
