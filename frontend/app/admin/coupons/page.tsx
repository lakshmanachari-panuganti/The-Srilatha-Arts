'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Ticket, Copy, ToggleLeft, ToggleRight, Trash2, Pencil, X } from 'lucide-react'
import { formatINR, formatDate } from '@/lib/format'
import { apiFetch } from '@/lib/api'

type CouponType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING'

interface Coupon {
  code: string
  type: CouponType
  value: number
  description?: string
  minOrderAmount?: number
  maxDiscount?: number
  startDate: string
  endDate?: string
  usageLimit?: number
  currentUsage: number
  active: boolean
  firstTimeOnly: boolean
  promoteInBanner: boolean
}

interface FormState {
  code: string
  type: CouponType
  value: string
  description: string
  minOrderAmount: string
  maxDiscount: string
  startDate: string
  endDate: string
  usageLimit: string
  active: boolean
  firstTimeOnly: boolean
  promoteInBanner: boolean
}

const BLANK_FORM: FormState = {
  code: '',
  type: 'PERCENTAGE',
  value: '',
  description: '',
  minOrderAmount: '',
  maxDiscount: '',
  startDate: '',
  endDate: '',
  usageLimit: '',
  active: true,
  firstTimeOnly: false,
  promoteInBanner: false,
}

const TYPE_LABELS: Record<CouponType, string> = {
  PERCENTAGE: '% Off',
  FIXED_AMOUNT: '₹ Off',
  FREE_SHIPPING: 'Free Ship',
}

const TYPE_COLORS: Record<CouponType, string> = {
  PERCENTAGE: 'bg-purple-50 text-purple-700 ring-purple-600/20',
  FIXED_AMOUNT: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  FREE_SHIPPING: 'bg-green-50 text-green-700 ring-green-600/20',
}

// All monetary amounts stored in paise - divide by 100 to display in ₹
function formatCouponValue(coupon: Coupon): string {
  switch (coupon.type) {
    case 'PERCENTAGE': return `${coupon.value}% off`
    case 'FIXED_AMOUNT': return `${formatINR(coupon.value / 100)} off`
    case 'FREE_SHIPPING': return 'Free shipping'
  }
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showActive, setShowActive] = useState<'all' | 'active' | 'inactive'>('all')
  const [toggling, setToggling] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Form (null = closed, 'new' = create, code = edit)
  const [formMode, setFormMode] = useState<'new' | string | null>(null)
  const [form, setForm] = useState<FormState>(BLANK_FORM)
  const [saving, setSaving] = useState(false)

  const fetchCoupons = useCallback(async () => {
    try {
      const data = await apiFetch<{ coupons: Coupon[] }>('/admin/coupons')
      setCoupons(data.coupons ?? [])
    } catch (err) {
      console.error('Failed to load coupons', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCoupons() }, [fetchCoupons])

  const openNew = () => {
    setForm(BLANK_FORM)
    setFormMode('new')
  }

  const openEdit = (c: Coupon) => {
    setForm({
      code: c.code,
      type: c.type,
      value: c.type === 'FIXED_AMOUNT' ? String(c.value / 100) : String(c.value),
      description: c.description ?? '',
      minOrderAmount: c.minOrderAmount ? String(c.minOrderAmount / 100) : '',
      maxDiscount: c.maxDiscount ? String(c.maxDiscount / 100) : '',
      startDate: c.startDate ? c.startDate.slice(0, 10) : '',
      endDate: c.endDate ? c.endDate.slice(0, 10) : '',
      usageLimit: c.usageLimit ? String(c.usageLimit) : '',
      active: c.active,
      firstTimeOnly: c.firstTimeOnly,
      promoteInBanner: c.promoteInBanner,
    })
    setFormMode(c.code)
  }

  const closeForm = () => {
    setFormMode(null)
    setForm(BLANK_FORM)
  }

  const buildBody = () => {
    // Convert display values back to paise for monetary amounts
    const valueNum = parseFloat(form.value) || 0
    return {
      type: form.type,
      // FIXED_AMOUNT: user enters ₹ rupees, store as paise (* 100)
      // PERCENTAGE: user enters %, store as-is
      value: form.type === 'FIXED_AMOUNT' ? Math.round(valueNum * 100) : valueNum,
      description: form.description || undefined,
      minOrderAmount: form.minOrderAmount ? Math.round(parseFloat(form.minOrderAmount) * 100) : undefined,
      maxDiscount: form.maxDiscount ? Math.round(parseFloat(form.maxDiscount) * 100) : undefined,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      usageLimit: form.usageLimit ? parseInt(form.usageLimit) : undefined,
      active: form.active,
      firstTimeOnly: form.firstTimeOnly,
      promoteInBanner: form.promoteInBanner,
    }
  }

  const handleSave = async () => {
    if (!form.type) return
    if (formMode === 'new' && !form.code.trim()) return
    setSaving(true)
    try {
      if (formMode === 'new') {
        const data = await apiFetch<{ coupon: Coupon }>('/admin/coupons', {
          method: 'POST',
          body: { code: form.code.trim().toUpperCase(), ...buildBody() },
        })
        setCoupons((prev) => [data.coupon, ...prev])
      } else {
        const data = await apiFetch<{ coupon: Coupon }>(`/admin/coupons/${formMode}`, {
          method: 'PATCH',
          body: buildBody(),
        })
        setCoupons((prev) => prev.map((c) => (c.code === formMode ? data.coupon : c)))
      }
      closeForm()
    } catch (err: unknown) {
      console.error('Failed to save coupon', err)
      const msg = err instanceof Error ? err.message : 'Failed to save coupon. Please try again.'
      alert(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (coupon: Coupon) => {
    setToggling(coupon.code)
    try {
      const data = await apiFetch<{ coupon: Coupon }>(`/admin/coupons/${coupon.code}`, {
        method: 'PATCH',
        body: { active: !coupon.active },
      })
      setCoupons((prev) => prev.map((c) => (c.code === coupon.code ? data.coupon : c)))
    } catch (err) {
      console.error('Failed to toggle coupon', err)
    } finally {
      setToggling(null)
    }
  }

  const handleDelete = async (code: string) => {
    if (!confirm(`Delete coupon "${code}"? This cannot be undone.`)) return
    setDeleting(code)
    try {
      await apiFetch(`/admin/coupons/${code}`, { method: 'DELETE' })
      setCoupons((prev) => prev.filter((c) => c.code !== code))
    } catch (err) {
      console.error('Failed to delete coupon', err)
      alert('Failed to delete coupon. Please try again.')
    } finally {
      setDeleting(null)
    }
  }

  const filtered = coupons.filter((c) => {
    if (showActive === 'active' && !c.active) return false
    if (showActive === 'inactive' && c.active) return false
    if (search) {
      const q = search.toLowerCase()
      return c.code.toLowerCase().includes(q) || (c.description?.toLowerCase().includes(q) ?? false)
    }
    return true
  })

  return (
    <div>
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl text-ink mb-1">Coupons</h1>
          <p className="text-ink-soft text-sm">Create and manage discount codes.</p>
        </div>
        <button
          onClick={openNew}
          className="btn-dark text-sm h-10 px-4 shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Coupon
        </button>
      </header>

      {/* Create / Edit form */}
      {formMode !== null && (
        <div className="bg-plum-light border border-lavender/30 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-ink">
              {formMode === 'new' ? 'New Coupon' : `Edit ${formMode}`}
            </h2>
            <button onClick={closeForm} className="text-ink-mute hover:text-ink">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {formMode === 'new' && (
              <div>
                <label className="block text-xs font-medium text-ink-soft mb-1">Code *</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="SAVE20"
                  className="w-full px-3 h-10 bg-plum border border-ink/10 rounded-lg text-sm text-ink placeholder:text-ink-mute font-mono uppercase focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Type *</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as CouponType }))}
                className="w-full px-3 h-10 bg-plum border border-ink/10 rounded-lg text-sm text-ink placeholder:text-ink-mute focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent"
              >
                <option value="PERCENTAGE">Percentage Off (%)</option>
                <option value="FIXED_AMOUNT">Fixed Amount (₹)</option>
                <option value="FREE_SHIPPING">Free Shipping</option>
              </select>
            </div>

            {form.type !== 'FREE_SHIPPING' && (
              <div>
                <label className="block text-xs font-medium text-ink-soft mb-1">
                  {form.type === 'PERCENTAGE' ? 'Discount (%)' : 'Discount (₹)'}
                </label>
                <input
                  type="number"
                  value={form.value}
                  onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                  min={0}
                  placeholder={form.type === 'PERCENTAGE' ? '20' : '200'}
                  className="w-full px-3 h-10 bg-plum border border-ink/10 rounded-lg text-sm text-ink placeholder:text-ink-mute focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Flat 20% off site-wide"
                className="w-full px-3 h-10 bg-plum border border-ink/10 rounded-lg text-sm text-ink placeholder:text-ink-mute focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Min Order (₹)</label>
              <input
                type="number"
                value={form.minOrderAmount}
                onChange={(e) => setForm((f) => ({ ...f, minOrderAmount: e.target.value }))}
                min={0}
                placeholder="999"
                className="w-full px-3 h-10 bg-plum border border-ink/10 rounded-lg text-sm text-ink placeholder:text-ink-mute focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent"
              />
            </div>

            {form.type === 'PERCENTAGE' && (
              <div>
                <label className="block text-xs font-medium text-ink-soft mb-1">Max Discount (₹)</label>
                <input
                  type="number"
                  value={form.maxDiscount}
                  onChange={(e) => setForm((f) => ({ ...f, maxDiscount: e.target.value }))}
                  min={0}
                  placeholder="500"
                  className="w-full px-3 h-10 bg-plum border border-ink/10 rounded-lg text-sm text-ink placeholder:text-ink-mute focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Start Date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                className="w-full px-3 h-10 bg-plum border border-ink/10 rounded-lg text-sm text-ink placeholder:text-ink-mute focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent [color-scheme:dark]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">End Date</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                className="w-full px-3 h-10 bg-plum border border-ink/10 rounded-lg text-sm text-ink placeholder:text-ink-mute focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent [color-scheme:dark]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Usage Limit</label>
              <input
                type="number"
                value={form.usageLimit}
                onChange={(e) => setForm((f) => ({ ...f, usageLimit: e.target.value }))}
                min={1}
                placeholder="Unlimited"
                className="w-full px-3 h-10 bg-plum border border-ink/10 rounded-lg text-sm text-ink placeholder:text-ink-mute focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent"
              />
            </div>

            <div className="sm:col-span-2 flex flex-wrap gap-x-6 gap-y-2">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} className="rounded" />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={form.firstTimeOnly} onChange={(e) => setForm((f) => ({ ...f, firstTimeOnly: e.target.checked }))} className="rounded" />
                First-time buyers only
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={form.promoteInBanner} onChange={(e) => setForm((f) => ({ ...f, promoteInBanner: e.target.checked }))} className="rounded" />
                Promote in banner
              </label>
            </div>
          </div>

          <div className="flex gap-3 mt-5">
            <button
              onClick={handleSave}
              disabled={saving || (formMode === 'new' && !form.code.trim())}
              className="btn-dark text-sm h-9 px-4 disabled:opacity-50"
            >
              {saving ? 'Saving…' : formMode === 'new' ? 'Create Coupon' : 'Save Changes'}
            </button>
            <button onClick={closeForm} className="text-sm text-ink-mute hover:text-ink px-2">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-mute" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code or description..."
            className="w-full pl-10 pr-4 h-10 bg-plum-light border border-ink/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent"
          />
        </div>
        <div className="chip-rail sm:flex sm:gap-2">
          {(['all', 'active', 'inactive'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setShowActive(tab)}
              className={`chip capitalize ${showActive === tab ? 'is-active' : ''}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Coupon Cards */}
      <div className="space-y-4">
        {loading && (
          <div className="bg-plum-light border border-ink/10 rounded-xl p-8 text-center">
            <p className="text-ink-soft text-sm">Loading coupons…</p>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="bg-plum-light border border-ink/10 rounded-xl p-8 text-center">
            <Ticket className="w-8 h-8 text-ink-mute mx-auto mb-3" />
            <p className="text-ink font-medium mb-1">No coupons found</p>
            <p className="text-sm text-ink-soft">Create your first coupon to start offering discounts.</p>
          </div>
        )}

        {filtered.map((coupon) => {
          const isExpired = coupon.endDate && new Date(coupon.endDate).getTime() < Date.now()
          const isMaxed = coupon.usageLimit && coupon.currentUsage >= coupon.usageLimit
          const isToggling = toggling === coupon.code
          const isDeleting = deleting === coupon.code

          return (
            <div
              key={coupon.code}
              className={`bg-plum-light border rounded-xl p-4 md:p-6 transition-colors ${
                !coupon.active || isExpired || isMaxed
                  ? 'border-ink/5 opacity-70'
                  : 'border-ink/10 hover:border-lavender/30'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-start gap-4">
                {/* Left: code + details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <code className="font-mono text-lg font-bold text-ink tracking-wider">
                      {coupon.code}
                    </code>
                    <button
                      onClick={() => navigator.clipboard.writeText(coupon.code)}
                      className="text-ink-mute hover:text-lavender transition-colors"
                      title="Copy code"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset ${TYPE_COLORS[coupon.type]}`}>
                      {TYPE_LABELS[coupon.type]}
                    </span>
                    {coupon.firstTimeOnly && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20">
                        First-time
                      </span>
                    )}
                    {coupon.promoteInBanner && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-lavender-pastel/20 text-plum ring-1 ring-inset ring-lavender/30">
                        In Banner
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-medium text-ink mb-1">
                    {formatCouponValue(coupon)}
                    {coupon.minOrderAmount != null && coupon.minOrderAmount > 0 && (
                      <span className="text-ink-soft font-normal ml-1">
                        · Min order {formatINR(coupon.minOrderAmount / 100)}
                      </span>
                    )}
                  </p>

                  {coupon.description && (
                    <p className="text-sm text-ink-soft mb-2">{coupon.description}</p>
                  )}

                  <div className="flex items-center gap-4 text-xs text-ink-mute flex-wrap">
                    <span>
                      {coupon.currentUsage}{coupon.usageLimit ? ` / ${coupon.usageLimit}` : ''} used
                    </span>
                    <span>From {formatDate(coupon.startDate)}</span>
                    {coupon.endDate && (
                      <span className={isExpired ? 'text-red-600 font-medium' : ''}>
                        {isExpired ? 'Expired' : `Until ${formatDate(coupon.endDate)}`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: status + actions */}
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => handleToggle(coupon)}
                    disabled={isToggling}
                    className={`flex items-center gap-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                      coupon.active
                        ? 'text-green-700 hover:text-green-800'
                        : 'text-ink-mute hover:text-ink'
                    }`}
                    title={coupon.active ? 'Active – click to deactivate' : 'Inactive – click to activate'}
                  >
                    {coupon.active ? (
                      <ToggleRight className="w-5 h-5" />
                    ) : (
                      <ToggleLeft className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={() => openEdit(coupon)}
                    className="text-ink-mute hover:text-plum transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(coupon.code)}
                    disabled={isDeleting}
                    className="text-ink-mute hover:text-red-600 transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
