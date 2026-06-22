'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { MessageCircle, Mail, ArrowRight, Palette, Ruler, Clock, CheckCircle2, X as XIcon } from 'lucide-react'
import { apiFetch, ApiError } from '@/lib/api'
import { useUserAuth } from '@/stores/userAuth'
import PhotoUploader from '@/components/PhotoUploader'
import { waLink, mailtoLink } from '@/lib/site-config'
import type { Product } from '@/types'

// Mirrors VALID_ART_FORMS in backend/src/functions/customOrders.ts.
// Keep in sync - the backend rejects any value not in this set.
const ART_FORMS: { value: string; label: string }[] = [
  { value: 'resin',       label: 'Resin Art' },
  { value: 'dot-mandala', label: 'Dot Mandala' },
  { value: 'lippan',      label: 'Lippan Art' },
  { value: 'pichwai',     label: 'Pichwai' },
  { value: 'kolam',       label: 'Kolam Art' },
  { value: 'wedding',     label: 'Wedding Decoratives' },
  { value: 'other',       label: 'Something else' },
]

const MAX_PHOTOS = 5

// Map the live category slug → the ART_FORMS value the backend accepts.
// They line up 1:1 today, but keeping this explicit means a future category
// rename (e.g. wedding → wedding-decoratives) won't silently fall through.
const CATEGORY_TO_ART_FORM: Record<string, string> = {
  resin: 'resin',
  'dot-mandala': 'dot-mandala',
  lippan: 'lippan',
  kolam: 'kolam',
  wedding: 'wedding',
}

export default function CustomOrderClient() {
  const user = useUserAuth((s) => s.user)
  const searchParams = useSearchParams()
  const sourceId = searchParams?.get('source') || null

  const [form, setForm] = useState({
    customerName: user?.name || '',
    customerEmail: user?.email || '',
    customerPhone: user?.phone || '',
    artForm: 'resin',
    size: '',
    palette: '',
    description: '',
    budget: '',
  })
  const [photos, setPhotos] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [success, setSuccess] = useState<string | null>(null)

  // Source product (when arriving from a PDP "Customise this art" link).
  // Fetched once, used to seed the form + render the small reference card.
  // Failure is silent - the form still works without it.
  const [source, setSource] = useState<Product | null>(null)
  const [sourceSeeded, setSourceSeeded] = useState(false)

  useEffect(() => {
    if (!sourceId || sourceSeeded) return
    let cancelled = false
    apiFetch<{ product: Product }>(`/products/${sourceId}`)
      .then((r) => {
        if (cancelled) return
        setSource(r.product)
        setSourceSeeded(true)
        setForm((s) => ({
          ...s,
          artForm: CATEGORY_TO_ART_FORM[r.product.category] || s.artForm,
          description: s.description.trim()
            ? s.description
            : `I'd love a custom version of "${r.product.title}". `,
        }))
        const primary = r.product.images?.[0]
        if (primary) setPhotos((cur) => (cur.length ? cur : [primary]))
      })
      .catch(() => {
        // Silent: the form still works without the reference; the user can
        // describe what they want in text + upload their own photos.
        if (!cancelled) setSourceSeeded(true)
      })
    return () => { cancelled = true }
  }, [sourceId, sourceSeeded])

  function clearSource() {
    setSource(null)
    // We don't yank the description / photos the user has had a chance to
    // edit - only remove the photo if it's still the seeded primary.
    if (source) {
      const primary = source.images?.[0]
      if (primary) setPhotos((cur) => cur.filter((p) => p !== primary))
    }
  }

  const on = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((s) => ({ ...s, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    // Required-field validation - mirror the backend exactly so users see
    // the issue inline before a round-trip.
    if (!form.customerName.trim()) { setErr('Please enter your name.'); return }
    if (!form.customerPhone.trim() && !form.customerEmail.trim()) {
      setErr('Please share either a phone number or an email so we can reach you.')
      return
    }
    if (!form.description.trim()) { setErr('Please describe what you have in mind.'); return }
    setBusy(true)
    try {
      const res = await apiFetch<{ ok: true; inquiryId: string; message: string }>(
        '/custom-orders',
        {
          method: 'POST',
          body: {
            customerName: form.customerName.trim(),
            customerEmail: form.customerEmail.trim() || undefined,
            customerPhone: form.customerPhone.trim() || undefined,
            artForm: form.artForm,
            size: form.size.trim() || undefined,
            palette: form.palette.trim() || undefined,
            description: form.description.trim(),
            budget: form.budget.trim() || undefined,
            referenceImages: photos,
          },
        },
      )
      setSuccess(res.message)
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        setErr('You’ve sent a few requests already in the last hour. Please try again later or message us on WhatsApp.')
      } else {
        setErr(e instanceof Error ? e.message : 'Could not submit. Please try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  if (success) {
    return (
      <main className="max-w-2xl mx-auto px-5 py-20 lg:py-28 text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-700 mx-auto mb-4 flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7" aria-hidden />
        </div>
        <p className="eyebrow justify-center mb-3">Request received</p>
        <h1 className="display text-4xl md:text-5xl mb-4">
          Thanks - we&apos;ll be in <em className="italic gold-text">touch</em>
        </h1>
        <p className="text-ivory-soft text-base mb-8">{success}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/" className="btn-dark">Back to the shop</Link>
          <Link href="/account" className="btn-outline">Go to my account</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="max-w-3xl mx-auto px-5 py-16 lg:py-24">
      <p className="eyebrow mb-3">Custom orders</p>
      <h1 className="display text-4xl md:text-5xl lg:text-6xl mb-5">
        Made <em className="italic gold-text">just for you</em>
      </h1>
      <p className="text-ivory-soft text-base lg:text-lg leading-relaxed mb-10">
        Have a specific size, colour or theme in mind? Tell us about it and we&apos;ll make a one-of-a-kind
        piece for you. Great for birthdays, anniversaries, housewarmings, or any occasion.
      </p>

      {/* Reference piece - shown when the visitor arrived via the PDP
          "Customise this art" CTA. Pre-fills artForm + a starter line in
          description + seeds the primary image as a reference photo. */}
      {source && (
        <div className="mb-8 rounded-2xl border border-glass-border bg-plum-light/30 p-4 flex items-center gap-4">
          <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-plum-light/50 shrink-0">
            {source.images?.[0] && (
              <Image
                src={source.images[0]}
                alt={source.title}
                fill
                sizes="64px"
                className="object-cover"
              />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wider text-ivory-mute mb-0.5">
              Customising
            </p>
            <p className="font-serif text-base text-ivory truncate">{source.title}</p>
            <Link
              href={`/product/${source.id}`}
              className="text-xs text-lavender-pastel hover:underline"
            >
              View original
            </Link>
          </div>
          <button
            type="button"
            onClick={clearSource}
            aria-label="Remove reference piece"
            className="w-9 h-9 rounded-full text-ivory-mute hover:text-ivory hover:bg-white/[0.06]
                       flex items-center justify-center transition-colors"
          >
            <XIcon className="w-4 h-4" aria-hidden />
          </button>
        </div>
      )}

      {/* Quick what-to-share grid - same content as before, kept for context */}
      <section className="mb-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Info icon={Palette} title="Style & colours" body="Resin, Dot Mandala, Lippan, Kolam or Wedding Decoratives - and your colour preferences." />
        <Info icon={Ruler} title="Size" body="The size in inches or where you plan to hang it (a photo of the wall helps a lot)." />
        <Info icon={Clock} title="Deadline" body="Tell us if you need it by a specific date so we can plan around it." />
      </section>

      {/* ── The form ────────────────────────────────────────── */}
      <form
        onSubmit={submit}
        className="rounded-2xl border border-glass-border bg-plum-light/30 p-5 lg:p-8 space-y-5"
      >
        <Field label="Your name *">
          <Input value={form.customerName} onChange={on('customerName')} placeholder="Full name" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Phone (WhatsApp)" hint="Either phone or email - we'll use it to reply.">
            <Input value={form.customerPhone} onChange={on('customerPhone')} placeholder="+91 …" inputMode="tel" />
          </Field>
          <Field label="Email">
            <Input value={form.customerEmail} onChange={on('customerEmail')} placeholder="you@example.com" type="email" />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Art form *">
            <select
              value={form.artForm}
              onChange={on('artForm')}
              className="form-input"
            >
              {ART_FORMS.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Approx size" hint="e.g. 16x16 inches">
            <Input value={form.size} onChange={on('size')} placeholder="Inches or rough dimensions" />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Colour palette" hint="Free text - moody pastels, gold + black, etc.">
            <Input value={form.palette} onChange={on('palette')} placeholder="Colours you like" />
          </Field>
          <Field label="Budget (₹)" hint="Optional - helps us match the right scope.">
            <Input value={form.budget} onChange={on('budget')} placeholder="e.g. 8000–15000" />
          </Field>
        </div>
        <Field label="Tell us about your piece *">
          <textarea
            value={form.description}
            onChange={on('description')}
            rows={5}
            placeholder="Occasion, theme, who it's for, what room it'll live in, any reference, deadline…"
            className="form-input resize-none"
          />
        </Field>

        {/* Reference photos - uploader handles its own validation, CSRF,
            and the anonymous-user case (shows "sign in" hint instead). */}
        <Field label="Reference photos (optional)">
          <PhotoUploader
            value={photos}
            onChange={setPhotos}
            max={MAX_PHOTOS}
            hint={user ? `Up to ${MAX_PHOTOS} images, 5 MB each.` : undefined}
          />
        </Field>

        {err && (
          <p
            className="text-sm rounded-lg px-3 py-2"
            style={{
              color: '#fca5a5',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
            }}
          >
            {err}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <button
            type="submit"
            disabled={busy}
            className="btn-dark sm:w-auto justify-center disabled:opacity-50"
          >
            {busy ? 'Sending…' : 'Send my request'}
            {!busy && <ArrowRight className="w-4 h-4" aria-hidden />}
          </button>
          <p className="text-xs text-ivory-mute">We reply as soon as possible, usually faster.</p>
        </div>
      </form>

      {/* ── Talk-to-us fallback ─────────────────────────────── */}
      <div className="card p-6 lg:p-8 text-center mt-10">
        <h2 className="font-serif text-xl lg:text-2xl text-ivory mb-3">Prefer to talk?</h2>
        <p className="text-ivory-soft mb-5 text-sm">Reach out on whichever is easiest for you.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a href={waLink("Hi Srilatha Art, I'd like to ask about a custom order.")} target="_blank" rel="noopener noreferrer" className="btn-dark">
            <MessageCircle className="w-4 h-4" aria-hidden /> WhatsApp us
          </a>
          <a href={mailtoLink()} className="btn-outline">
            <Mail className="w-4 h-4" aria-hidden /> Email us
          </a>
        </div>
      </div>

      <p className="text-ivory-soft text-sm text-center mt-8">
        Prefer to browse first? <Link href="/shop" className="text-lavender-pastel hover:underline inline-flex items-center gap-1">See our ready-made pieces <ArrowRight className="w-3.5 h-3.5" aria-hidden /></Link>
      </p>
    </main>
  )
}

function Field({
  label, hint, children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-ivory-mute mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-ivory-mute mt-1">{hint}</span>}
    </label>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`form-input ${props.className || ''}`}
    />
  )
}

function Info({
  icon: Icon, title, body,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  body: string
}) {
  return (
    <div className="rounded-2xl border border-glass-border bg-plum-light/20 p-5">
      <Icon className="w-5 h-5 text-lavender-pastel mb-2" aria-hidden />
      <p className="font-medium text-ivory mb-1">{title}</p>
      <p className="text-sm text-ivory-soft leading-relaxed">{body}</p>
    </div>
  )
}
