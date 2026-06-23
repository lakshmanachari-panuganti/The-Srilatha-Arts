'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Tag, Pencil, Trash2, ToggleLeft, ToggleRight, ExternalLink, Clock, X } from 'lucide-react'
import { formatDate } from '@/lib/format'
import { apiFetch, ApiError } from '@/lib/api'

type AnnouncementTheme = 'gold' | 'festive-pink' | 'muted'

interface Announcement {
  id: string
  message: string
  href: string
  startDate?: string
  endDate?: string
  priority: number
  theme: AnnouncementTheme
  active: boolean
  linkedCouponCode?: string
}

interface FormState {
  message: string
  href: string
  theme: AnnouncementTheme
  priority: number
  active: boolean
  startDate: string
  endDate: string
  linkedCouponCode: string
}

const BLANK_FORM: FormState = {
  message: '',
  href: '/',
  theme: 'gold',
  priority: 99,
  active: true,
  startDate: '',
  endDate: '',
  linkedCouponCode: '',
}

const THEME_LABELS: Record<AnnouncementTheme, { label: string; color: string }> = {
  gold:           { label: 'Gold',    color: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  'festive-pink': { label: 'Festive', color: 'bg-pink-50 text-pink-700 ring-pink-600/20' },
  muted:          { label: 'Muted',   color: 'bg-gray-50 text-gray-700 ring-gray-600/20' },
}

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Form state (null = closed, 'new' = create, id = edit)
  const [formMode, setFormMode] = useState<'new' | string | null>(null)
  const [form, setForm] = useState<FormState>(BLANK_FORM)
  const [saving, setSaving] = useState(false)

  const fetchAnnouncements = useCallback(async () => {
    try {
      const data = await apiFetch<{ announcements: Announcement[] }>('/admin/announcements')
      setAnnouncements(data.announcements ?? [])
    } catch (err) {
      console.error('Failed to load announcements', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAnnouncements() }, [fetchAnnouncements])

  const openNew = () => {
    setForm(BLANK_FORM)
    setFormMode('new')
  }

  const openEdit = (ann: Announcement) => {
    setForm({
      message: ann.message,
      href: ann.href,
      theme: ann.theme,
      priority: ann.priority,
      active: ann.active,
      startDate: ann.startDate ? ann.startDate.slice(0, 10) : '',
      endDate: ann.endDate ? ann.endDate.slice(0, 10) : '',
      linkedCouponCode: ann.linkedCouponCode ?? '',
    })
    setFormMode(ann.id)
  }

  const closeForm = () => {
    setFormMode(null)
    setForm(BLANK_FORM)
  }

  const handleSave = async () => {
    if (!form.message.trim()) return
    setSaving(true)
    try {
      const body = {
        message: form.message.trim(),
        href: form.href.trim() || '/',
        theme: form.theme,
        priority: Number(form.priority),
        active: form.active,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        linkedCouponCode: form.linkedCouponCode.trim() || undefined,
      }

      if (formMode === 'new') {
        const data = await apiFetch<{ announcement: Announcement }>('/admin/announcements', {
          method: 'POST',
          body,
        })
        setAnnouncements((prev) => [data.announcement, ...prev])
      } else {
        const data = await apiFetch<{ announcement: Announcement }>(`/admin/announcements/${formMode}`, {
          method: 'PATCH',
          body,
        })
        setAnnouncements((prev) =>
          prev.map((a) => (a.id === formMode ? data.announcement : a)),
        )
      }
      closeForm()
    } catch (err) {
      console.error('Failed to save announcement', err)
      const detail = err instanceof ApiError
        ? `${err.message}${err.status ? ` (HTTP ${err.status})` : ''}`
        : err instanceof Error
          ? err.message
          : 'Unknown error'
      alert(`Failed to save announcement.\n\n${detail}`)
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (ann: Announcement) => {
    setToggling(ann.id)
    try {
      const data = await apiFetch<{ announcement: Announcement }>(`/admin/announcements/${ann.id}`, {
        method: 'PATCH',
        body: { active: !ann.active },
      })
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === ann.id ? data.announcement : a)),
      )
    } catch (err) {
      console.error('Failed to toggle announcement', err)
    } finally {
      setToggling(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this announcement? This cannot be undone.')) return
    setDeleting(id)
    try {
      await apiFetch(`/admin/announcements/${id}`, { method: 'DELETE' })
      setAnnouncements((prev) => prev.filter((a) => a.id !== id))
    } catch (err) {
      console.error('Failed to delete announcement', err)
      alert('Failed to delete announcement. Please try again.')
    } finally {
      setDeleting(null)
    }
  }

  const activeCount = announcements.filter((a) => a.active).length

  return (
    <div>
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl text-ink mb-1">Announcements</h1>
          <p className="text-ink-soft text-sm">
            Manage the marquee banner at the top of your site.
            <span className="ml-1 text-green-700 font-medium">{activeCount} active.</span>
          </p>
        </div>
        <button
          onClick={openNew}
          className="btn-dark text-sm h-10 px-4 shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Announcement
        </button>
      </header>

      {/* Info */}
      <div className="bg-lavender-pastel/10 border border-lavender/20 rounded-xl p-4 mb-6">
        <p className="text-sm text-ink">
          <strong>Tip:</strong> Active announcements scroll right-to-left in the marquee banner.
          The banner is hidden on{' '}
          <code className="text-xs bg-plum-light px-1.5 py-0.5 rounded">/admin</code> and{' '}
          <code className="text-xs bg-plum-light px-1.5 py-0.5 rounded">/checkout</code> pages.
        </p>
      </div>

      {/* Create / Edit form */}
      {formMode !== null && (
        <div className="bg-plum-light border border-lavender/30 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-ink">
              {formMode === 'new' ? 'New Announcement' : 'Edit Announcement'}
            </h2>
            <button onClick={closeForm} className="text-ink-mute hover:text-ink">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-ink-soft mb-1">Message *</label>
              <input
                type="text"
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                maxLength={200}
                placeholder="e.g. FLAT 30% OFF on all orders · Ends Sunday"
                className="w-full px-3 h-10 bg-plum border border-ink/10 rounded-lg text-sm text-ink placeholder:text-ink-mute focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Link URL</label>
              <input
                type="text"
                value={form.href}
                onChange={(e) => setForm((f) => ({ ...f, href: e.target.value }))}
                placeholder="/shop"
                className="w-full px-3 h-10 bg-plum border border-ink/10 rounded-lg text-sm text-ink placeholder:text-ink-mute focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Coupon Code</label>
              <input
                type="text"
                value={form.linkedCouponCode}
                onChange={(e) => setForm((f) => ({ ...f, linkedCouponCode: e.target.value.toUpperCase() }))}
                placeholder="SRILATHA30"
                className="w-full px-3 h-10 bg-plum border border-ink/10 rounded-lg text-sm font-mono text-ink placeholder:text-ink-mute focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Theme</label>
              <select
                value={form.theme}
                onChange={(e) => setForm((f) => ({ ...f, theme: e.target.value as AnnouncementTheme }))}
                className="w-full px-3 h-10 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent"
              >
                <option value="gold">Gold</option>
                <option value="festive-pink">Festive Pink</option>
                <option value="muted">Muted</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Priority (lower = higher)</label>
              <input
                type="number"
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
                min={1}
                className="w-full px-3 h-10 bg-plum border border-ink/10 rounded-lg text-sm text-ink placeholder:text-ink-mute focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent"
              />
            </div>

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

            <div className="sm:col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="ann-active"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                className="rounded accent-lavender"
              />
              <label htmlFor="ann-active" className="text-sm text-ink">Active (show in banner)</label>
            </div>
          </div>

          <div className="flex gap-3 mt-5">
            <button
              onClick={handleSave}
              disabled={saving || !form.message.trim()}
              className="btn-dark text-sm h-9 px-4 disabled:opacity-50"
            >
              {saving ? 'Saving…' : formMode === 'new' ? 'Create' : 'Save Changes'}
            </button>
            <button onClick={closeForm} className="text-sm text-ink-mute hover:text-ink px-2">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Announcement Cards */}
      <div className="space-y-4">
        {loading && (
          <div className="bg-plum-light border border-ink/10 rounded-xl p-8 text-center">
            <p className="text-ink-soft text-sm">Loading announcements…</p>
          </div>
        )}

        {!loading && announcements.length === 0 && (
          <div className="bg-plum-light border border-ink/10 rounded-xl p-8 text-center">
            <Tag className="w-8 h-8 text-ink-mute mx-auto mb-3" />
            <p className="text-ink font-medium mb-1">No announcements yet</p>
            <p className="text-sm text-ink-soft">Create your first announcement to display in the marquee banner.</p>
          </div>
        )}

        {announcements.map((ann) => {
          const isExpired = ann.endDate && new Date(ann.endDate).getTime() < Date.now()
          const isScheduled = ann.startDate && new Date(ann.startDate).getTime() > Date.now()
          const themeInfo = THEME_LABELS[ann.theme]
          const isToggling = toggling === ann.id
          const isDeleting = deleting === ann.id

          return (
            <div
              key={ann.id}
              className={`bg-plum-light border rounded-xl p-4 md:p-6 transition-colors ${
                !ann.active || isExpired
                  ? 'border-ink/5 opacity-70'
                  : 'border-ink/10 hover:border-lavender/30'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-start gap-4">
                {/* Priority badge */}
                <div className="hidden md:flex w-8 h-8 rounded-full bg-lavender-pastel/20 items-center justify-center text-sm font-bold text-plum shrink-0">
                  {ann.priority}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="md:hidden text-xs font-bold text-plum bg-lavender-pastel/20 px-2 py-0.5 rounded-full">
                      #{ann.priority}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset ${themeInfo.color}`}>
                      {themeInfo.label}
                    </span>
                    {ann.linkedCouponCode && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20">
                        🎟 {ann.linkedCouponCode}
                      </span>
                    )}
                    {isScheduled && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20">
                        <Clock className="w-3 h-3" />
                        Scheduled
                      </span>
                    )}
                    {isExpired && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10">
                        Expired
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-medium text-ink mb-1.5">✨ {ann.message}</p>

                  <div className="flex items-center gap-3 text-xs text-ink-mute flex-wrap">
                    <a href={ann.href} className="inline-flex items-center gap-1 hover:text-lavender transition-colors">
                      {ann.href} <ExternalLink className="w-3 h-3" />
                    </a>
                    {ann.startDate && <span>From {formatDate(ann.startDate)}</span>}
                    {ann.endDate && (
                      <span className={isExpired ? 'text-red-600' : ''}>
                        Until {formatDate(ann.endDate)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => handleToggle(ann)}
                    disabled={isToggling}
                    className={`flex items-center gap-1 text-sm font-medium transition-colors disabled:opacity-50 ${
                      ann.active ? 'text-green-700 hover:text-green-800' : 'text-ink-mute hover:text-ink'
                    }`}
                    title={ann.active ? 'Active – click to deactivate' : 'Inactive – click to activate'}
                  >
                    {ann.active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => openEdit(ann)}
                    className="text-ink-mute hover:text-plum transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(ann.id)}
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
