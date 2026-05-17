'use client'

import { useEffect, useState } from 'react'
import {
  Store, Truck, CreditCard, Users, Bell, Globe,
  AlertCircle, Check, Loader2, BadgePercent,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface ShippingConfig {
  baseCharge: number
  effectiveCharge: number
  freeThreshold: number
  discountLabel?: string
}

const SETTINGS_SECTIONS = [
  { title: 'General',         description: 'Store name, contact info, social links.',                icon: Store,      active: true,  anchor: '#general' },
  { title: 'Shipping',        description: 'Standard charge, discount, free-shipping threshold.',  icon: Truck,      active: true,  anchor: '#shipping' },
  { title: 'Payments',        description: 'Razorpay keys, COD settings, refund policies.',         icon: CreditCard, active: false, anchor: '#' },
  { title: 'Staff & Roles',   description: 'Admin accounts, roles, and permissions.',               icon: Users,      active: false, anchor: '#' },
  { title: 'Notifications',   description: 'WhatsApp, email, and push notification templates.',     icon: Bell,       active: false, anchor: '#' },
  { title: 'Domain & SEO',    description: 'Custom domain, meta tags, and sitemap settings.',       icon: Globe,      active: false, anchor: '#' },
]

// Convert paise <-> rupees for display. Keeping paise as the storage unit
// means the admin can never accidentally write a fractional rupee value.
const toRupees = (paise: number) => Math.round(paise) / 100
const toPaise  = (rupees: number) => Math.round(rupees * 100)

export default function AdminSettingsPage() {
  return (
    <div>
      <header className="mb-8">
        <h1 className="font-serif text-3xl text-ink mb-1">Settings</h1>
        <p className="text-ink-soft text-sm">Configure your store, shipping, payments, and more.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SETTINGS_SECTIONS.map(({ title, description, icon: Icon, active, anchor }) => (
          <a
            key={title}
            href={active ? anchor : undefined}
            className={`block bg-plum-light border rounded-xl p-6 transition-all group ${
              active
                ? 'border-ink/10 hover:border-lavender/30 hover:shadow-sm cursor-pointer'
                : 'border-ink/5 opacity-60 pointer-events-none'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-lavender-pastel/30 flex items-center justify-center text-plum shrink-0 group-hover:bg-lavender-pastel/50 transition-colors">
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-medium text-ink mb-1 group-hover:text-plum transition-colors">{title}</h3>
                <p className="text-sm text-ink-soft leading-relaxed">{description}</p>
                {!active && (
                  <span className="inline-block mt-2 text-xs font-medium text-ink-mute bg-paper px-2 py-0.5 rounded">
                    Coming soon
                  </span>
                )}
              </div>
            </div>
          </a>
        ))}
      </div>

      <GeneralSection />
      <ShippingSection />
    </div>
  )
}

// ─── General (placeholder, not yet wired to a backend) ──────────────────────

function GeneralSection() {
  return (
    <section id="general" className="mt-10 scroll-mt-20">
      <h2 className="font-serif text-xl text-ink mb-4">General</h2>
      <div className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-6 space-y-6">
        <FieldRow label="Store name"        defaultValue="Srilatha Art" />
        <FieldRow label="Contact email"     defaultValue="studio@srilatha.art" type="email" />
        <FieldRow label="WhatsApp number"   defaultValue="+91 91332 66754" type="tel" />
        <p className="text-xs text-ink-mute">
          (These fields aren&apos;t wired to a backend yet — they&apos;re for layout only.)
        </p>
      </div>
    </section>
  )
}

function FieldRow({ label, defaultValue, type = 'text' }: { label: string; defaultValue: string; type?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink-soft mb-1.5">{label}</label>
      <input
        type={type}
        defaultValue={defaultValue}
        className="w-full max-w-md h-11 px-4 bg-plum border border-ink/10 rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent transition-all"
      />
    </div>
  )
}

// ─── Shipping ────────────────────────────────────────────────────────────────

function ShippingSection() {
  const [loaded, setLoaded] = useState(false)
  const [loadErr, setLoadErr] = useState('')
  const [base, setBase] = useState(99)            // rupees, for the form
  const [effective, setEffective] = useState(99)  // rupees
  const [threshold, setThreshold] = useState(2999) // rupees
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [saveErr, setSaveErr] = useState('')
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  useEffect(() => {
    let cancelled = false
    apiFetch<{ shipping: ShippingConfig }>('/admin/shipping-settings')
      .then((r) => {
        if (cancelled) return
        setBase(toRupees(r.shipping.baseCharge))
        setEffective(toRupees(r.shipping.effectiveCharge))
        setThreshold(toRupees(r.shipping.freeThreshold))
        setLabel(r.shipping.discountLabel ?? '')
        setLoaded(true)
      })
      .catch((e) => {
        if (cancelled) return
        setLoadErr(e instanceof Error ? e.message : 'Could not load shipping settings')
        setLoaded(true)
      })
    return () => { cancelled = true }
  }, [])

  const discountActive = effective < base
  const savingsRupees = Math.max(0, base - effective)
  const savingsPct = base > 0 ? Math.round((savingsRupees / base) * 100) : 0

  const validate = (): string | null => {
    if (!Number.isFinite(base) || base < 0) return 'Standard charge must be 0 or more'
    if (!Number.isFinite(effective) || effective < 0) return 'Discounted charge must be 0 or more'
    if (effective > base) return 'Discounted charge cannot be more than the standard charge'
    if (!Number.isFinite(threshold) || threshold < 0) return 'Free-shipping threshold must be 0 or more'
    if (label.length > 80) return 'Discount label must be 80 characters or less'
    return null
  }

  async function save() {
    setSaveErr('')
    const err = validate()
    if (err) { setSaveErr(err); return }
    setBusy(true)
    try {
      const r = await apiFetch<{ shipping: ShippingConfig }>('/admin/shipping-settings', {
        method: 'PATCH',
        body: {
          baseCharge: toPaise(base),
          effectiveCharge: toPaise(effective),
          freeThreshold: toPaise(threshold),
          discountLabel: label.trim() || undefined,
        },
      })
      setBase(toRupees(r.shipping.baseCharge))
      setEffective(toRupees(r.shipping.effectiveCharge))
      setThreshold(toRupees(r.shipping.freeThreshold))
      setLabel(r.shipping.discountLabel ?? '')
      setSavedAt(new Date())
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section id="shipping" className="mt-10 scroll-mt-20">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-xl text-ink">Shipping</h2>
        {discountActive && (
          <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
            <BadgePercent className="w-3.5 h-3.5" />
            Discount active · {savingsPct}% off
          </span>
        )}
      </div>

      <div className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-6">
        {!loaded ? (
          <div className="flex items-center gap-2 text-sm text-ink-mute">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading current settings…
          </div>
        ) : loadErr ? (
          <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{loadErr}</span>
          </div>
        ) : (
          <>
            <p className="text-sm text-ink-soft mb-5 leading-relaxed">
              The <strong>standard charge</strong> is what we say is the regular delivery price.
              The <strong>discounted charge</strong> is what customers actually pay — if it&apos;s lower than the standard,
              the cart will show the strike-through pricing automatically. Set both to the same value to remove the discount.
              Orders above the <strong>free-shipping threshold</strong> always ship free, regardless of either charge.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <NumberField
                label="Standard charge (₹)"
                value={base}
                onChange={setBase}
                hint="The “regular price” shown crossed out."
                min={0}
              />
              <NumberField
                label="Discounted charge (₹)"
                value={effective}
                onChange={setEffective}
                hint={discountActive ? `Customers pay this — saves ₹${savingsRupees} per order.` : 'Equal to standard = no discount.'}
                min={0}
              />
              <NumberField
                label="Free shipping above (₹)"
                value={threshold}
                onChange={setThreshold}
                hint="Carts at or above this subtotal ship for free."
                min={0}
              />
            </div>

            <div className="mt-5 max-w-md">
              <label className="block text-sm font-medium text-ink-soft mb-1.5">
                Discount label (optional)
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={80}
                placeholder="e.g. Festive offer · 50% off delivery"
                className="w-full h-11 px-4 bg-plum border border-ink/10 rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent"
              />
              <p className="text-xs text-ink-mute mt-1.5">
                Shown on the cart and checkout when a discount is active. Leave blank for no banner.
              </p>
            </div>

            {/* Live preview of what the customer will see in the cart */}
            <div className="mt-6 rounded-lg border border-ink/10 bg-paper px-4 py-3">
              <p className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Cart preview</p>
              <div className="flex items-baseline gap-2 text-sm text-ink tabular-nums">
                <span>Shipping</span>
                {effective === 0 ? (
                  <span className="ml-auto text-emerald-600 font-semibold">Free</span>
                ) : (
                  <>
                    {discountActive && (
                      <span className="ml-auto text-ink-mute line-through">₹{base}</span>
                    )}
                    <span className={discountActive ? 'text-emerald-600 font-semibold' : 'ml-auto font-semibold'}>
                      ₹{effective}
                    </span>
                  </>
                )}
              </div>
              {discountActive && label && (
                <p className="text-xs text-emerald-700 mt-1">{label}</p>
              )}
              <p className="text-xs text-ink-mute mt-2">
                Carts at or above <strong>₹{threshold}</strong> ship free.
              </p>
            </div>

            {saveErr && (
              <div className="mt-5 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{saveErr}</span>
              </div>
            )}
            {savedAt && !saveErr && (
              <div className="mt-5 flex items-center gap-2 text-sm text-emerald-700">
                <Check className="w-4 h-4" /> Saved at {savedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}.
              </div>
            )}

            <div className="pt-5 mt-5 border-t border-ink/10 flex flex-wrap gap-2">
              <button onClick={save} disabled={busy} className="btn-dark text-sm h-10 px-6 disabled:opacity-60">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {busy ? 'Saving…' : 'Save shipping settings'}
              </button>
              <button
                onClick={() => { setEffective(base); setLabel('') }}
                className="text-sm h-10 px-4 rounded-full border border-ink/15 text-ink hover:bg-cream-deep"
              >
                Remove discount
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

function NumberField({
  label, value, onChange, hint, min,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  hint?: string
  min?: number
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink-soft mb-1.5">{label}</label>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        step={1}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        className="w-full h-11 px-4 bg-plum border border-ink/10 rounded-lg text-ink tabular-nums focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent transition-all"
      />
      {hint && <p className="text-xs text-ink-mute mt-1.5 leading-snug">{hint}</p>}
    </div>
  )
}
