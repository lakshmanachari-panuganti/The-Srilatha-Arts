import type { Metadata } from 'next'
import PlaceholderPage from '@/components/PlaceholderPage'

export const metadata: Metadata = {
  title: 'Care Guide',
  description: 'How to care for your handcrafted art.',
}

export default function CareGuidePage() {
  return (
    <PlaceholderPage
      eyebrow="Living with art"
      title="A guide to long life"
      goldWord="long life"
    />
  )
}
