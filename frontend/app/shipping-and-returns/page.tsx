import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Shipping & Returns',
  description: 'How shipping, exchanges and returns work at Srilatha Art.',
}

export default function ShippingPage() {
  return (
    <main className="max-w-3xl mx-auto px-5 py-16 lg:py-24">
      <p className="eyebrow mb-3">Shipping &amp; returns</p>
      <h1 className="display text-4xl md:text-5xl lg:text-6xl mb-6">
        How <em className="italic gold-text">delivery</em> works
      </h1>

      <h2 className="font-serif text-2xl lg:text-3xl text-ivory mt-10 mb-3">Shipping</h2>
      <ul className="space-y-3 text-ivory-soft text-base lg:text-lg leading-relaxed">
        <li>• Most orders arrive in <strong>5–7 working days</strong> across India.</li>
        <li>• <strong>Free shipping</strong> on orders above ₹2,999. Below that, shipping is a flat ₹99.</li>
        <li>• We ship from Hyderabad. You&apos;ll get a tracking link once your order is dispatched.</li>
        <li>• Every piece is bubble-wrapped and packed in a sturdy box so it arrives safely.</li>
      </ul>

      <h2 className="font-serif text-2xl lg:text-3xl text-ivory mt-10 mb-3">Returns &amp; exchanges</h2>
      <ul className="space-y-3 text-ivory-soft text-base lg:text-lg leading-relaxed">
        <li>• You can request a return within <strong>7 days of delivery</strong> if the item is unused and in its original packaging.</li>
        <li>• Custom pieces are made just for you, so they cannot be returned. We&apos;ll share photos before shipping a custom order, so you can approve.</li>
        <li>• If your order arrives damaged, <Link href="/contact" className="text-lavender-pastel hover:underline">message us</Link> within 48 hours with a photo and we&apos;ll sort it out.</li>
      </ul>

      <h2 className="font-serif text-2xl lg:text-3xl text-ivory mt-10 mb-3">Refunds</h2>
      <ul className="space-y-3 text-ivory-soft text-base lg:text-lg leading-relaxed">
        <li>• Once we receive the returned item, refunds are processed within 5–7 working days.</li>
        <li>• The amount comes back to the same account or card you paid with.</li>
      </ul>

      <p className="text-ivory-soft text-base lg:text-lg leading-relaxed mt-10">
        Need help with an order? <Link href="/contact" className="text-lavender-pastel hover:underline">Contact us</Link> — we usually reply within a few hours.
      </p>
    </main>
  )
}
