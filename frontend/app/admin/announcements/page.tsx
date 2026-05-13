'use client'

import { useState } from 'react'
import { Plus, Tag, Pencil, Trash2, ToggleLeft, ToggleRight, ExternalLink, Clock } from 'lucide-react'
import { formatDate } from '@/lib/format'

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

const MOCK_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'ann-001',
    message: 'FLAT 30% OFF on all Resin Art · Use code SRILATHA30 · Ends Sunday',
    href: '/shop/resin',
    startDate: '2026-05-01T00:00:00Z',
    endDate: '2026-05-31T23:59:59Z',
    priority: 1,
    theme: 'gold',
    active: true,
    linkedCouponCode: 'SRILATHA30',
  },
  {
    id: 'ann-002',
    message: 'Free shipping on orders above ₹2,999 · Pan-India delivery',
    href: '/shipping-and-returns',
    priority: 2,
    theme: 'gold',
    active: true,
  },
  {
    id: 'ann-003',
    message: 'Custom Creations open · 2 slots left this month',
    href: '/custom-order',
    priority: 3,
    theme: 'festive-pink',
    active: true,
  },
  {
    id: 'ann-004',
    message: 'Diwali Collection coming soon · Stay tuned!',
    href: '/collections',
    startDate: '2026-10-01T00:00:00Z',
    endDate: '2026-11-15T23:59:59Z',
    priority: 4,
    theme: 'gold',
    active: false,
  },
]

const THEME_LABELS: Record<AnnouncementTheme, { label: string; color: string }> = {
  gold:          { label: 'Gold',   color: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  'festive-pink': { label: 'Festive', color: 'bg-pink-50 text-pink-700 ring-pink-600/20' },
  muted:         { label: 'Muted',  color: 'bg-gray-50 text-gray-700 ring-gray-600/20' },
}

export default function AdminAnnouncementsPage() {
  const [announcements] = useState(MOCK_ANNOUNCEMENTS)

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
        <button className="btn-dark text-sm h-10 px-4 shrink-0 self-start sm:self-auto">
          <Plus className="w-4 h-4 mr-2" />
          New Announcement
        </button>
      </header>

      {/* Info */}
      <div className="bg-lavender-pastel/10 border border-lavender/20 rounded-xl p-4 mb-6">
        <p className="text-sm text-ink">
          <strong>Tip:</strong> Active announcements scroll right-to-left in the marquee banner.
          Drag to reorder by priority. The banner is hidden on <code className="text-xs bg-plum-light px-1.5 py-0.5 rounded">/admin</code> and <code className="text-xs bg-plum-light px-1.5 py-0.5 rounded">/checkout</code> pages.
        </p>
      </div>

      {/* Announcement Cards */}
      <div className="space-y-4">
        {announcements.length === 0 && (
          <div className="bg-plum-light border border-ink/10 rounded-xl p-8 text-center">
            <Tag className="w-8 h-8 text-ink-mute mx-auto mb-3" />
            <p className="text-ink font-medium mb-1">No announcements yet</p>
            <p className="text-sm text-ink-soft">Create your first announcement to display in the marquee banner.</p>
          </div>
        )}

        {announcements.map((ann, i) => {
          const isExpired = ann.endDate && new Date(ann.endDate).getTime() < Date.now()
          const isScheduled = ann.startDate && new Date(ann.startDate).getTime() > Date.now()
          const themeInfo = THEME_LABELS[ann.theme]

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
                    className={`flex items-center gap-1 text-sm font-medium transition-colors ${
                      ann.active ? 'text-green-700 hover:text-green-800' : 'text-ink-mute hover:text-ink'
                    }`}
                    title={ann.active ? 'Active – click to deactivate' : 'Inactive – click to activate'}
                  >
                    {ann.active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                  <button className="text-ink-mute hover:text-plum transition-colors" title="Edit">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button className="text-ink-mute hover:text-red-600 transition-colors" title="Delete">
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
