import type { Metadata } from 'next'
import PlaceholderPage from '@/components/PlaceholderPage'

export const metadata: Metadata = { title: 'Sign in' }

export default function LoginPage() {
  return (
    <PlaceholderPage
      eyebrow="Welcome back"
      title="Sign in to your account"
      goldWord="account"
      description="Sign-in lands in Phase 2 — JWT cookie auth with Google one-tap and OTP."
    />
  )
}
