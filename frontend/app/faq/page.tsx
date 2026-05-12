import type { Metadata } from 'next'
import PlaceholderPage from '@/components/PlaceholderPage'

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Frequently asked questions.',
}

export default function FAQPage() {
  return <PlaceholderPage eyebrow="Help" title="Frequently asked questions" goldWord="asked" />
}
