import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Care guide',
  description: 'How to take care of your handmade art so it lasts for years.',
}

export default function CareGuidePage() {
  return (
    <main className="max-w-3xl mx-auto px-5 py-16 lg:py-24">
      <p className="eyebrow mb-3">Care guide</p>
      <h1 className="display text-4xl md:text-5xl lg:text-6xl mb-6">
        How to <em className="italic gold-text">care</em> for your art
      </h1>
      <p className="text-ivory-soft text-base lg:text-lg leading-relaxed mb-10">
        A little care goes a long way. Follow these simple tips and your piece will look great for years.
      </p>

      <Section title="Day-to-day care">
        <Item><strong>Keep it dry.</strong> Avoid hanging art in bathrooms or other very damp places.</Item>
        <Item><strong>Stay out of direct sunlight.</strong> Strong sunlight all day can slowly fade the colours.</Item>
        <Item><strong>Dust gently.</strong> Use a soft, dry cloth — like an old cotton t-shirt — once a week.</Item>
        <Item><strong>No harsh cleaners.</strong> Don&apos;t use soap, water, or any cleaning sprays directly on the art.</Item>
      </Section>

      <Section title="Resin Art">
        <Item>Wipe with a dry microfibre cloth. For a deeper clean, use a slightly damp cloth — never soak it.</Item>
        <Item>Don&apos;t place hot items directly on resin coasters; let them cool first.</Item>
      </Section>

      <Section title="Dot Mandala (painted art)">
        <Item>Dust gently with a soft brush or dry cloth.</Item>
        <Item>If a corner gets a small bump or scratch, leave it as it is — re-touching at home can make it worse.</Item>
      </Section>

      <Section title="Lippan (clay &amp; mirror art)">
        <Item>The mirrors are firmly set, but don&apos;t scrub them. Just dust with a soft brush.</Item>
        <Item>Hang it on a smooth wall using the hook on the back — don&apos;t lay it flat for long periods.</Item>
      </Section>

      <Section title="Kolam">
        <Item>The pattern is sealed, so a soft dry cloth is all you need.</Item>
        <Item>Avoid placing it in steamy areas like the kitchen wall directly behind a stove.</Item>
      </Section>

      <p className="text-ivory-soft text-base lg:text-lg leading-relaxed mt-12 mb-3">
        Have a question about a specific piece? <Link href="/contact" className="text-lavender-pastel hover:underline">Message us</Link> — we&apos;re happy to help.
      </p>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="font-serif text-2xl lg:text-3xl text-ivory mb-4">{title}</h2>
      <ul className="space-y-3">{children}</ul>
    </section>
  )
}

function Item({ children }: { children: React.ReactNode }) {
  return (
    <li className="text-ivory-soft text-base lg:text-lg leading-relaxed flex gap-3">
      <span className="text-lavender-pastel mt-1.5 shrink-0">•</span>
      <span>{children}</span>
    </li>
  )
}
