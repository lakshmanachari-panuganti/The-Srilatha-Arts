import type { Metadata } from 'next'
import PlaceholderPage from '@/components/PlaceholderPage'

export const metadata: Metadata = {
  title: 'Custom Order — Commission a piece',
  description:
    'Tell us your vision. We craft bespoke pieces in any art form, palette and size — 2–4 weeks turnaround.',
}

export default function CustomOrderPage() {
  return (
    <PlaceholderPage
      eyebrow="Bespoke commissions"
      title="Tell us your vision"
      goldWord="your"
      description="Have a custom piece in mind? WhatsApp us at +91 91332 66754 with your ideas, and we’ll get back to you within 24 hours."
      primaryHref="/contact"
      primaryLabel="Open contact"
    />
  )
}
