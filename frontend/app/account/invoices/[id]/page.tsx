// Printable invoice — fully client-side so any order ID resolves at runtime,
// not at build time. The SWA rewrite (staticwebapp.config.json) routes
// /account/invoices/<orderId> to this shell. The client reads the real id
// from window.location.pathname. URL sits under /account/invoices/ rather
// than nested under /account/orders/<id>/invoice because Azure SWA only
// allows wildcards at the END of a route, so a middle-wildcard rewrite
// for /account/orders/*/invoice fails config validation.
import InvoiceClient from './InvoiceClient'

export function generateStaticParams() {
  return [{ id: '__shell__' }]
}

export default function InvoicePage() {
  return <InvoiceClient />
}
