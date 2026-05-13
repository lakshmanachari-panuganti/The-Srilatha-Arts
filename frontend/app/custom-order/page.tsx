import type { Metadata } from 'next'
import PlaceholderPage from '@/components/PlaceholderPage'

export const metadata: Metadata = {
  title: 'Custom Creations — Bring Your Ideas to Home',
  description:
    'Share your vision. We craft bespoke pieces in any art form, palette and size — 1-2 weeks turnaround.',
}

export default function CustomOrderPage() {
  return (
    <PlaceholderPage
      eyebrow="Custom Creations"
      title="Bring Your Ideas to Home"
      goldWord="your"
      description="Have a custom piece in mind? WhatsApp us at +91 91332 66754 with your ideas, and we’ll get back to you within 24 hours."
      primaryHref="/contact"
      primaryLabel="Open contact"
    />
  )
}
