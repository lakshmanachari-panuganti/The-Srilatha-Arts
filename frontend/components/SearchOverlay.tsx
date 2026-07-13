'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'
import { Search as SearchIcon, X, ArrowUpRight } from 'lucide-react'
import { useUI } from '@/stores/ui'
import { apiFetch } from '@/lib/api'
import type { Product } from '@/types'
import { formatINR } from '@/lib/format'

export default function SearchOverlay() {
  const open = useUI((s) => s.searchOpen)
  const setOpen = useUI((s) => s.setSearchOpen)
  const [q, setQ] = useState('')
  const [allProducts, setAllProducts] = useState<Product[]>([])

  useEffect(() => {
    if (open) {
      if (allProducts.length === 0) {
        apiFetch<{ products: Product[] }>('/products').then(res => setAllProducts(res.products || []))
      }
      const t = setTimeout(() => {
        document.getElementById('tsa-search-input')?.focus()
      }, 80)
      return () => clearTimeout(t)
    }
    setQ('')
  }, [open, allProducts.length])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return []
    return allProducts.filter(
      (p) =>
        p.title.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term) ||
        (p.shortDescription || '').toLowerCase().includes(term),
    ).slice(0, 8)
  }, [q, allProducts])

  const popular = ['Dot Mandala', 'Resin Coasters', 'Lippan', 'Kolam', 'Wedding Decoratives']

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-20 sm:pt-32"
          style={{
            background: 'rgba(7, 8, 10, 0.78)',
            backdropFilter: 'blur(12px) saturate(140%)',
            WebkitBackdropFilter: 'blur(12px) saturate(140%)',
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Search"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          {/* Centred modal - solid obsidian card with gold rim. Stops click
              propagation so backdrop dismissal only fires on the dim layer. */}
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className="w-full max-w-2xl"
            style={{
              background: '#0F172A',
              border: '1px solid rgba(148, 163, 184, 0.10)',
              borderRadius: '20px',
              boxShadow: '0 24px 60px -22px rgba(0, 0, 0, 0.75), 0 0 24px rgba(59, 130, 246, 0.18)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 sm:px-6 pt-5 sm:pt-6 safe-pt">
              <div className="flex items-center gap-3 mb-6">
                <SearchIcon className="w-5 h-5 shrink-0" style={{ color: 'var(--accent-gold)' }} aria-hidden />
                <input
                  id="tsa-search-input"
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search for art, styles, gift ideas…"
                  className="flex-1 bg-transparent outline-none py-2 text-lg font-serif"
                  style={{
                    color: 'var(--text-primary)',
                    borderBottom: '1px solid rgba(148,163,184,0.20)',
                  }}
                  onFocus={(e) => (e.target.style.borderBottomColor = 'rgba(59,130,246,0.65)')}
                  onBlur={(e) => (e.target.style.borderBottomColor = 'rgba(148,163,184,0.20)')}
                />
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close search"
                  className="min-h-11 min-w-11 -mr-1 flex items-center justify-center transition-colors duration-300"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  <X className="w-5 h-5" aria-hidden />
                </button>
              </div>

              {q.trim() === '' ? (
                <div className="pb-6">
                  <p className="eyebrow mb-3" style={{ color: 'var(--accent-gold)' }}>Popular searches</p>
                  <div className="flex flex-wrap gap-2">
                    {popular.map((p) => (
                      <button key={p} onClick={() => setQ(p)} className="chip">
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              ) : results.length === 0 ? (
                <p className="py-10 text-center font-serif text-lg pb-6" style={{ color: 'var(--text-muted)' }}>
                  Nothing found. Try a different word.
                </p>
              ) : (
                <ul className="pb-3 max-h-[60vh] overflow-y-auto">
                  {results.map((p) => (
                    <li key={p.id} style={{ borderBottom: '1px solid rgba(148,163,184,0.10)' }}>
                      <Link
                        href={`/product/${p.id}`}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 py-3 -mx-2 px-2 transition-colors duration-300 rounded-xl"
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(59,130,246,0.10)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <Image
                          src={p.images[0]}
                          alt=""
                          width={56}
                          height={56}
                          className="w-14 h-14 object-contain p-2 rounded-xl"
                          style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(148,163,184,0.12)',
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-serif text-base truncate" style={{ color: 'var(--text-primary)' }}>{p.title}</p>
                          <p className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>
                            {p.category.replace('-', ' ')} · {formatINR(p.price)}
                          </p>
                        </div>
                        <ArrowUpRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
