import type { Metadata } from 'next'
import PlaceholderPage from '@/components/PlaceholderPage'

export const metadata: Metadata = { title: 'My Account' }

export default function AccountPage() {
  return (
    <PlaceholderPage
      eyebrow="Account"
      title="Your account, your orders"
      goldWord="orders"
      description="The full self-service account area - orders, tracking, wishlist, addresses, coupons - ships in Phase 2. For now please WhatsApp us with order queries."
      primaryHref="/login"
      primaryLabel="Sign in"
    />
  )
}
