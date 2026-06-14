import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Common questions',
  description: 'Answers to common questions about orders, shipping, and custom pieces.',
  alternates: { canonical: '/faq/' },
}

const faqs = [
  {
    q: 'Are your pieces really handmade?',
    a: 'Yes - every single one. We make each piece by hand in our Hyderabad studio. That means no two pieces look exactly alike, and tiny differences are part of what makes them special.',
  },
  {
    q: 'How long does delivery take?',
    a: 'Most orders arrive in 5–7 working days across India. You\'ll get a tracking link by SMS and email once your order is on the way.',
  },
  {
    q: 'Do you ship outside India?',
    a: 'Not yet. Right now we only ship within India. We\'re hoping to add international shipping soon.',
  },
  {
    q: 'Is shipping free?',
    a: 'Shipping is free on orders above ₹999. Below that, it\'s a flat ₹99 anywhere in India.',
  },
  {
    q: 'Can I order a custom piece?',
    a: 'Yes! Tell us the colours, size and style you want and we\'ll make one for you. Custom orders usually take 1–2 weeks. Start at our custom orders page.',
  },
  {
    q: 'Can I return an item?',
    a: 'You can return any non-custom item within 7 days of delivery, as long as it\'s unused and in its original packaging. Custom orders can\'t be returned since they\'re made just for you.',
  },
  {
    q: 'My order arrived damaged. What do I do?',
    a: 'We\'re really sorry. Message us within 48 hours with a photo and we\'ll send a replacement or refund right away.',
  },
  {
    q: 'How should I care for my art?',
    a: 'Keep it away from direct sunlight and damp areas. Dust gently with a soft, dry cloth. See our full care guide for tips per art style.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'UPI, all major debit and credit cards, netbanking and popular wallets. Payments are handled securely through Razorpay.',
  },
  {
    q: 'How do I track my order?',
    a: 'Once your order ships, you\'ll get a tracking link by SMS and email. You can also see the status anytime in your account under "My orders".',
  },
]

export default function FAQPage() {
  return (
    <main className="max-w-3xl mx-auto px-5 py-16 lg:py-24">
      <p className="eyebrow mb-3">Help</p>
      <h1 className="display text-4xl md:text-5xl lg:text-6xl mb-6">
        Common <em className="italic gold-text">questions</em>
      </h1>
      <p className="text-ivory-soft text-base lg:text-lg leading-relaxed mb-10">
        Quick answers to the things people ask us most. Can&apos;t find what you&apos;re looking for?
        <Link href="/contact" className="text-lavender-pastel hover:underline ml-1">Send us a message</Link>.
      </p>

      <div className="space-y-2">
        {faqs.map((item) => (
          <details
            key={item.q}
            className="group rounded-2xl border border-glass-border bg-plum-light/30 px-5 py-4"
          >
            <summary className="cursor-pointer list-none flex items-center justify-between gap-3 font-medium text-ivory">
              {item.q}
              <span className="text-lavender-pastel text-xl group-open:rotate-45 transition-transform shrink-0" aria-hidden>＋</span>
            </summary>
            <p className="text-ivory-soft text-base leading-relaxed mt-3">
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </main>
  )
}
