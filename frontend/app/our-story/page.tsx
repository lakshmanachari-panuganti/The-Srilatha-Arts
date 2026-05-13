import type { Metadata } from 'next'
import PlaceholderPage from '@/components/PlaceholderPage'

export const metadata: Metadata = {
  title: 'Our Story',
  description: 'How Srilatha built a small craft house from a single skylit studio in Hyderabad.',
}

export default function OurStoryPage() {
  return (
    <PlaceholderPage
      eyebrow="The studio"
      title="A skylit room in Hyderabad"
      goldWord="Hyderabad"
      description="The full editorial story is being written - illustrations, behind-the-scenes photos, and a hand-drawn signature animation are on the way."
    />
  )
}
