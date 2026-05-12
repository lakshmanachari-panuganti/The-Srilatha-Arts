import type { Metadata } from 'next'
import PlaceholderPage from '@/components/PlaceholderPage'

export const metadata: Metadata = {
  title: 'Shipping & Returns',
  description: 'How shipping, exchanges and returns work.',
}

export default function ShippingPage() {
  return <PlaceholderPage eyebrow="Policies" title="Shipping & returns" goldWord="returns" />
}
