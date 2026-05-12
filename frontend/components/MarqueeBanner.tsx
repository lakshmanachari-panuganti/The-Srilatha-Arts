'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X, Sparkles } from 'lucide-react'
import type { Announcement } from '@/types'

const DISMISS_KEY = 'tsa_marquee_dismissed_at'
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000

export default function MarqueeBanner({ items }: { items: Announcement[] }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const stored = Number(localStorage.getItem(DISMISS_KEY) || 0)
    setVisible(Date.now() - stored > DISMISS_TTL_MS && items.length > 0)
  }, [items.length])

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.style.setProperty('--banner-h', visible ? '28px' : '0px')
  }, [visible])

  if (!visible || items.length === 0) return null

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setVisible(false)
  }

  const loop = [...items, ...items]

  return (
    <div
      role="region"
      aria-label="Site announcements"
      className="fixed top-0 inset-x-0 z-[60] h-7 sm:h-8
                 bg-gradient-to-r from-gold via-gold-light to-gold
                 text-primary-dark overflow-hidden flex items-center
                 shadow-[0_1px_8px_rgba(212,175,55,0.25)]"
    >
      <div className="flex-1 overflow-hidden">
        <div
          className="flex whitespace-nowrap will-change-transform
                     animate-marquee motion-reduce:animate-none pause-on-hover"
        >
          {loop.map((a, i) => (
            <Link
              key={`${a.id}-${i}`}
              href={a.href}
              className="mx-6 sm:mx-8 inline-flex items-center gap-2 text-[12px] sm:text-[13px]
                         font-semibold tracking-wide hover:underline underline-offset-4"
            >
              <Sparkles className="w-3 h-3 shrink-0" aria-hidden />
              <span>{a.message}</span>
            </Link>
          ))}
        </div>
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss announcements"
        className="px-2 h-full flex items-center hover:bg-primary-dark/10 transition-colors"
      >
        <X className="w-3.5 h-3.5" aria-hidden />
      </button>
    </div>
  )
}
