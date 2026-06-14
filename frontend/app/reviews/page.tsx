import type { Metadata } from 'next'
import ReviewsClient from './ReviewsClient'

export const metadata: Metadata = {
  title: 'Customer reviews',
  description:
    'Real reviews from people who bought our handmade art. Verified after delivery, moderated by the studio.',
  alternates: { canonical: '/reviews/' },
}

export default function ReviewsPage() {
  return <ReviewsClient />
}
