import { Truck, Hand, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react'

const items = [
  { icon: Truck, label: 'Free shipping above ₹2,999' },
  { icon: Hand, label: 'Handmade in Hyderabad' },
  { icon: RotateCcw, label: '7-day exchange' },
  { icon: ShieldCheck, label: 'Secure payments' },
  { icon: Sparkles, label: 'Custom commissions' },
]

export default function TrustStrip() {
  return (
    <section
      aria-label="Why The Srilatha Arts"
      className="border-y border-gold/10 bg-primary-dark/30"
    >
      <div className="chip-rail py-3 max-w-7xl mx-auto px-5 lg:px-8 lg:justify-center lg:flex-wrap lg:gap-x-10">
        {items.map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex items-center gap-2 text-[12px] sm:text-[13px] text-cream/70 whitespace-nowrap"
          >
            <Icon className="w-4 h-4 text-gold shrink-0" aria-hidden />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
