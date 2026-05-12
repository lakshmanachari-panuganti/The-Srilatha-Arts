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
      description="Email info@thesrilathaarts.com or WhatsApp +91 9133266754. We answer most messages within few hours."
    />
  )
}
