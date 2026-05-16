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

  const popular = ['Dot Mandala', 'Resin Coasters', 'Lippan', 'Pichwai', 'Kolam']

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[80]"
          style={{
            background: 'rgba(76,29,149,0.97)',
            backdropFilter: 'blur(20px)',
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Search"
        >
          <div className="max-w-2xl mx-auto px-5 pt-8 sm:pt-14 safe-pt">
            <div className="flex items-center gap-3 mb-6">
              <SearchIcon className="w-5 h-5 text-lavender-pastel shrink-0" aria-hidden />
              <input
                id="tsa-search-input"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search for art, styles, gift ideas…"
                className="flex-1 bg-transparent outline-none text-ivory placeholder:text-ivory-mute py-2 text-lg font-serif"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.15)' }}
                onFocus={(e) => e.target.style.borderBottomColor = 'rgba(200,182,255,0.5)'}
                onBlur={(e) => e.target.style.borderBottomColor = 'rgba(255,255,255,0.15)'}
              />
              <button
                onClick={() => setOpen(false)}
                aria-label="Close search"
                className="min-h-11 min-w-11 -mr-2 flex items-center justify-center
                           text-ivory-mute hover:text-ivory transition-colors duration-500"
              >
                <X className="w-5 h-5" aria-hidden />
              </button>
            </div>

            {q.trim() === '' ? (
              <div>
                <p className="eyebrow mb-3">Popular searches</p>
                <div className="flex flex-wrap gap-2">
                  {popular.map((p) => (
                    <button key={p} onClick={() => setQ(p)} className="chip">
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ) : results.length === 0 ? (
              <p className="text-ivory-mute py-10 text-center font-serif text-lg italic">
                Nothing found. Try a different word.
              </p>
            ) : (
              <ul>
                {results.map((p) => (
                  <li key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <Link
                      href={`/product/${p.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 py-3 -mx-2 px-2 transition-colors duration-500"
                      style={{ borderRadius: '16px' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <Image
                        src={p.images[0]}
                        alt=""
                        width={56}
                        height={56}
                        className="w-14 h-14 object-contain p-2"
                        style={{
                          borderRadius: '16px',
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.06)',
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-ivory font-serif text-base truncate">{p.title}</p>
                        <p className="text-xs text-ivory-mute capitalize">
                          {p.category.replace('-', ' ')} · {formatINR(p.price)}
                        </p>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-ivory-mute" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
