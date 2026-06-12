import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: 'How we collect and use your information, in plain English.',
  alternates: { canonical: '/privacy-policy/' },
}

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-5 py-16 lg:py-24">
      <p className="eyebrow mb-3">Legal</p>
      <h1 className="display text-4xl md:text-5xl lg:text-6xl mb-6">
        <em className="italic gold-text">Privacy</em> policy
      </h1>
      <p className="text-ivory-soft text-base lg:text-lg leading-relaxed mb-10">
        Your privacy is important to us. Here&apos;s what we collect, why we collect it, and what we do with it - in plain English.
      </p>

      <Section title="What we collect">
        <p>When you buy from us or sign up, we collect:</p>
        <ul className="mt-2 space-y-1 ml-5 list-disc">
          <li>Your name, email and phone number</li>
          <li>Your shipping address(es)</li>
          <li>Your order history with us</li>
        </ul>
        <p className="mt-3">We do <strong>not</strong> store your card or UPI details - those go straight to our payment partner Razorpay, which is a regulated, secure provider.</p>
      </Section>

      <Section title="Why we collect it">
        <ul className="space-y-1 ml-5 list-disc">
          <li>To process your order and ship it to you</li>
          <li>To send order updates (placed, packed, shipped, delivered)</li>
          <li>To answer your questions if you contact us</li>
          <li>To send the occasional update about new pieces - only if you opt in</li>
        </ul>
      </Section>

      <Section title="Who we share it with">
        We share only what&apos;s necessary, only with the services that help us run the business:
        <ul className="mt-2 space-y-1 ml-5 list-disc">
          <li><strong>Razorpay</strong> - to process payments securely</li>
          <li><strong>Courier partners</strong> - to deliver your order</li>
          <li><strong>Email and SMS providers</strong> - to send order updates</li>
        </ul>
        We never sell your information to anyone.
      </Section>

      <Section title="Cookies">
        We use a few small cookies to keep you signed in and to remember your cart. We don&apos;t use cookies for advertising or tracking across other websites.
      </Section>

      <Section title="Your rights">
        You can ask us to:
        <ul className="mt-2 space-y-1 ml-5 list-disc">
          <li>Show you what information we have about you</li>
          <li>Correct any wrong information</li>
          <li>Delete your account and personal information</li>
          <li>Stop sending you marketing emails (you can also unsubscribe from any email)</li>
        </ul>
        Just <Link href="/contact" className="text-lavender-pastel hover:underline">message us</Link> and we&apos;ll take care of it within 7 days.
      </Section>

      <Section title="Security">
        We use industry-standard security - HTTPS everywhere, hashed passwords, and signed sessions. Payments run through Razorpay&apos;s PCI-DSS-compliant systems.
      </Section>

      <Section title="Contact">
        Privacy questions? Email <a className="text-lavender-pastel hover:underline" href="mailto:studio@srilatha.art">studio@srilatha.art</a>.
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
      <div className="text-ivory-soft text-base lg:text-lg leading-relaxed">{children}</div>
    </section>
  )
}
