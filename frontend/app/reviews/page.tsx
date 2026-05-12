import type { Metadata } from 'next'
import PlaceholderPage from '@/components/PlaceholderPage'

export const metadata: Metadata = {
  title: 'Reviews',
  description: 'What our community says.',
}

export default function ReviewsPage() {
  return (
    <PlaceholderPage
      eyebrow="Words from collectors"
      title="The community wall"
      goldWord="community"
    />
  )
}
