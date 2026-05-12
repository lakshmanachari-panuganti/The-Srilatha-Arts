import type { Metadata } from 'next'
import PlaceholderPage from '@/components/PlaceholderPage'

export const metadata: Metadata = {
  title: 'The Craft',
  description: 'How each art form is made — long-form editorial pages.',
}

export default function TheCraftPage() {
  return (
    <PlaceholderPage
      eyebrow="Long-form editorial"
      title="How it's all made"
      goldWord="made"
      description="Per-art-form editorial pages with history, technique, video and a 'shop this form' CTA are being typeset. Subscribe below to be notified."
    />
  )
}
