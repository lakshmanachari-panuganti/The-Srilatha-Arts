import type { Metadata } from 'next'
import PlaceholderPage from '@/components/PlaceholderPage'

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Reach out — we usually respond within a day.',
}

export default function ContactPage() {
  return (
    <PlaceholderPage
      eyebrow="Say hello"
      title="We'd love to hear from you"
      goldWord="from you"
      description="Email hello@thesrilathaarts.com or WhatsApp +91 99999 99999. We answer most messages within 24 hours."
    />
  )
}
