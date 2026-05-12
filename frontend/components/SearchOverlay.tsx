'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'
import { Search as SearchIcon, X, ArrowUpRight } from 'lucide-react'
import { useUI } from '@/stores/ui'
import { PRODUCTS } from '@/data/products'
import { formatINR } from '@/lib/format'

export default function SearchOverlay() {
  const open = useUI((s) => s.searchOpen)
  const setOpen = useUI((s) => s.setSearchOpen)
  const [q, setQ] = useState('')

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => {
        document.getElementById('tsa-search-input')?.focus()
      }, 80)
      return () => clearTimeout(t)
    }
    setQ('')
  }, [open])

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
    return PRODUCTS.filter(
      (p) =>
        p.title.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term) ||
        p.shortDescription.toLowerCase().includes(term),
    ).slice(0, 8)
  }, [q])

  const popular = ['Dot Mandala', 'Resin Coasters', 'Lippan', 'Pichwai', 'Kolam']

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[80] bg-cream/98 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="Search"
        >
          <div className="max-w-2xl mx-auto px-5 pt-8 sm:pt-14 safe-pt">
            <div className="flex items-center gap-3 mb-6">
              <SearchIcon className="w-5 h-5 text-terracotta shrink-0" aria-hidden />
              <input
                id="tsa-search-input"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search products, art forms, occasions…"
                className="flex-1 bg-transparent border-b border-ink/20 focus:border-ink
                           outline-none text-ink placeholder:text-ink-mute py-2 text-lg font-serif"
              />
              <button
                onClick={() => setOpen(false)}
                aria-label="Close search"
                className="min-h-11 min-w-11 -mr-2 flex items-center justify-center
                           text-ink-mute hover:text-ink"
              >
                <X className="w-5 h-5" aria-hidden />
              </button>
            </div>

            {q.trim() === '' ? (
              <div>
                <p className="eyebrow mb-3">Popular</p>
                <div className="flex flex-wrap gap-2">
                  {popular.map((p) => (
                    <button key={p} onClick={() => setQ(p)} className="chip">
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ) : results.length === 0 ? (
              <p className="text-ink-mute py-10 text-center font-serif text-lg italic">
                No matches yet. Try a different word.
              </p>
            ) : (
              <ul className="divide-y divide-ink/8">
                {results.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/product/${p.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 py-3 hover:bg-cream-deep -mx-2 px-2 rounded-xl transition-colors"
                    >
                      <Image
                        src={p.images[0]}
                        alt=""
                        width={56}
                        height={56}
                        className="w-14 h-14 object-contain p-2 rounded-xl bg-cream-deep"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-ink font-serif text-base truncate">{p.title}</p>
                        <p className="text-xs text-ink-mute capitalize">
                          {p.category.replace('-', ' ')} · {formatINR(p.price)}
                        </p>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-ink-mute" aria-hidden />
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
