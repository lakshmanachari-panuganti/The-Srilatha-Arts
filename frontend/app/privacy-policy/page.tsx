import type { Metadata } from 'next'
import PlaceholderPage from '@/components/PlaceholderPage'

export const metadata: Metadata = { title: 'Privacy Policy' }

export default function PrivacyPage() {
  return <PlaceholderPage eyebrow="Legal" title="Privacy policy" goldWord="Privacy" />
}
