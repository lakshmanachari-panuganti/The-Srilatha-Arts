import type { Metadata } from 'next'
import PlaceholderPage from '@/components/PlaceholderPage'

export const metadata: Metadata = { title: 'Checkout' }

export default function CheckoutPage() {
  return (
    <PlaceholderPage
      eyebrow="Almost yours"
      title="Checkout is being readied"
      goldWord="Checkout"
      description="The full Razorpay-powered checkout (address, shipping method, payment, coupon) ships in Phase 2. For now WhatsApp us to confirm your order."
      primaryHref="/cart"
      primaryLabel="Back to cart"
    />
  )
}
