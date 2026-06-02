import type { Metadata } from 'next'
import PlaceholderPage from '@/components/PlaceholderPage'

export const metadata: Metadata = { title: 'Collections' }

export default function CollectionsPage() {
  return (
    <PlaceholderPage
      eyebrow="Coming soon"
      title="Themed gift sets"
      goldWord="gift sets"
      description="We're putting together themed sets - Diwali picks, housewarming gifts and more. Check back soon, or browse all our pieces in the meantime."
    />
  )
}
