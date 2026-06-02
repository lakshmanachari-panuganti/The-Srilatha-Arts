// Customer order detail - fully client-side so orders placed after the
// last static deploy are still reachable. generateStaticParams returns a
// single shell entry to satisfy Next.js's static-export requirement;
// the SWA rewrite routes /account/orders/* to this shell so the client
// router takes over and reads the real id from window.location.
import OrderDetailClient from './OrderDetailClient'

export function generateStaticParams() {
  return [{ id: '__shell__' }]
}

export default function OrderDetailPage() {
  return <OrderDetailClient />
}
