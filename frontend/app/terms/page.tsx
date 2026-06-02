import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of use',
  description: 'The simple terms for using the Srilatha Art website.',
}

export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-5 py-16 lg:py-24">
      <p className="eyebrow mb-3">Legal</p>
      <h1 className="display text-4xl md:text-5xl lg:text-6xl mb-6">
        <em className="italic gold-text">Terms</em> of use
      </h1>
      <p className="text-ivory-soft text-base lg:text-lg leading-relaxed mb-10">
        Plain-English terms for using this website and ordering from us.
      </p>

      <Section title="1. About us">
        We are Srilatha Art, a small handmade-art studio based in Hyderabad, India. Throughout these terms, &ldquo;we&rdquo; and &ldquo;our&rdquo; mean Srilatha Art. &ldquo;You&rdquo; means anyone who visits this site or buys from us.
      </Section>

      <Section title="2. Using this website">
        Please use the site like a normal customer would. Don&apos;t copy our photos or descriptions for your own use, and don&apos;t try to break the site. The content (images, text, art designs) is ours - we&apos;re happy for you to share links to a product page, but please don&apos;t reuse the content elsewhere without asking.
      </Section>

      <Section title="3. Orders">
        When you place an order, we confirm it by email. We&apos;ll start making your piece (or pick it from stock) once your payment is successful. If we can&apos;t fulfil an order for any reason - out of stock, payment issue, or anything else - we&apos;ll get in touch and offer a full refund.
      </Section>

      <Section title="4. Prices and payment">
        All prices are in Indian Rupees and include all taxes. Payments are handled securely by Razorpay. We never see or store your card details on our servers.
      </Section>

      <Section title="5. Shipping, returns and refunds">
        See our <Link href="/shipping-and-returns" className="text-lavender-pastel hover:underline">Shipping &amp; Returns</Link> page for full details. In short: 5–7 days delivery, 7-day return window for non-custom items, full refund if your order arrives damaged.
      </Section>

      <Section title="6. Custom orders">
        Custom pieces are made just for you, based on what you ask for. We&apos;ll share photos for your approval before shipping. Once approved, custom orders cannot be returned.
      </Section>

      <Section title="7. Handmade differences">
        Because every piece is made by hand, no two are exactly alike. Tiny colour or pattern differences from the photo on this site are normal and are part of what makes each piece one of a kind.
      </Section>

      <Section title="8. Privacy">
        We only collect the information we need to process your order. See our <Link href="/privacy-policy" className="text-lavender-pastel hover:underline">Privacy Policy</Link> for details.
      </Section>

      <Section title="9. Contact">
        Questions about these terms? Email us at <a className="text-lavender-pastel hover:underline" href="mailto:studio@srilatha.art">studio@srilatha.art</a> or message us on WhatsApp at +91 91332 66754.
      </Section>

      <p className="text-ivory-mute text-sm mt-12">
        Last updated: 16 May 2026
      </p>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="font-serif text-xl lg:text-2xl text-ivory mb-3">{title}</h2>
      <p className="text-ivory-soft text-base lg:text-lg leading-relaxed">{children}</p>
    </section>
  )
}
