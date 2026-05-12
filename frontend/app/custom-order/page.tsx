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
      description="The full multi-step commission form is in development. In the meantime, WhatsApp us at +91 99999 99999 with your idea and we'll get back within 24 hours."
      primaryHref="/contact"
      primaryLabel="Open contact"
    />
  )
}
