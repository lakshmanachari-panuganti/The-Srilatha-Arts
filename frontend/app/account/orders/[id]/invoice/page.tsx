// Printable invoice — fully client-side so any order ID resolves at runtime,
// not at build time. The SWA rewrite (staticwebapp.config.json) routes
// /account/orders/<id>/invoice to this shell. The client reads the real id
// from window.location.pathname.
import InvoiceClient from './InvoiceClient'

export function generateStaticParams() {
  return [{ id: '__shell__' }]
}

export default function InvoicePage() {
  return <InvoiceClient />
}
