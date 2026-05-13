import type { Metadata } from 'next'
import PlaceholderPage from '@/components/PlaceholderPage'

export const metadata: Metadata = { title: 'Collections' }

export default function CollectionsPage() {
  return (
    <PlaceholderPage
      eyebrow="Curated bundles"
      title="Collections"
      goldWord="Collections"
      description="Themed bundles - Diwali Picks, Housewarming Gifts and more - coming soon."
    />
  )
}
