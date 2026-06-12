import type { Metadata } from 'next'
import CustomOrderClient from './CustomOrderClient'

export const metadata: Metadata = {
  title: 'Custom orders',
  description:
    'Tell us about a piece you want made - size, style, colours, deadline. Or message us on WhatsApp.',
  alternates: { canonical: '/custom-order/' },
}

export default function CustomOrderPage() {
  return <CustomOrderClient />
}
