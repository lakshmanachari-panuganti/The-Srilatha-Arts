// Product detail page - fully client-side so that products created after a deploy
// are accessible without rebuilding. generateStaticParams returns a single shell entry
// to satisfy Next.js's static-export requirement; all real data fetching happens in
// ProductDetailClient via useQuery.
import ProductDetailClient from './ProductDetailClient'

// A single placeholder keeps the build happy. The staticwebapp.config.json rewrite
// routes /product/* to this shell so client-side navigation can take over.
export function generateStaticParams() {
  return [{ id: '__shell__' }]
}

export default function ProductPage() {
  return <ProductDetailClient />
}
