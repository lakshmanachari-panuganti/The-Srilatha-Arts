import type { Metadata } from 'next'
import PlaceholderPage from '@/components/PlaceholderPage'

export const metadata: Metadata = { title: 'Terms of Use' }

export default function TermsPage() {
  return <PlaceholderPage eyebrow="Legal" title="Terms of use" goldWord="Terms" />
}
