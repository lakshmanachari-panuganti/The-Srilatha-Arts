'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Lock } from 'lucide-react'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    // In Phase 2: Call POST /api/auth/admin/login
    // For now, mock redirect to admin dashboard
    window.location.href = '/admin'
  }

  return (
    <div className="min-h-screen bg-plum flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-lavender-pastel/40 to-transparent" />
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-plum-warm/10 rounded-full blur-3xl" />
      <div className="absolute top-1/2 -left-32 w-80 h-80 bg-lavender/20 rounded-full blur-3xl" />

      <main className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block font-serif text-3xl text-ink tracking-wide mb-2">
            Srilatha<em className="italic gold-text ml-1.5">Art</em>
          </Link>
          <p className="text-sm font-medium tracking-wider uppercase text-ink-mute">Admin Portal</p>
        </div>

        <div className="card-cream p-8 md:p-10 shadow-xl shadow-ink/5">
          <div className="flex items-center gap-3 text-ink mb-6">
            <Lock className="w-5 h-5 text-terracotta" />
            <h1 className="font-serif text-2xl">Secure Login</h1>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-ink-soft mb-1.5" htmlFor="email">
                Admin Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full h-11 px-4 bg-plum-light border border-ink/10 rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent transition-all"
                placeholder="studio@srilatha.art"
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
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full h-11 px-4 bg-plum-light border border-ink/10 rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent transition-all"
                placeholder="••••••••"
              />
            </div>

            <button type="submit" className="btn-dark w-full justify-center h-12 mt-2">
              Access Workspace
              <ArrowRight className="w-4 h-4 ml-2" />
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
