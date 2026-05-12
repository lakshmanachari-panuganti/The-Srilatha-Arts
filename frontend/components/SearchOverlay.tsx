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
          className="fixed inset-0 z-[80] bg-ink/90 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="Search"
        >
          <div className="max-w-2xl mx-auto px-4 pt-6 sm:pt-12 safe-pt">
            <div className="flex items-center gap-3 mb-5">
              <SearchIcon className="w-5 h-5 text-gold shrink-0" aria-hidden />
              <input
                id="tsa-search-input"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search products, art forms, occasions…"
                className="flex-1 bg-transparent border-b border-gold/30 focus:border-gold
                           outline-none text-cream placeholder:text-cream/40 py-2 text-base"
              />
              <button
                onClick={() => setOpen(false)}
                aria-label="Close search"
                className="min-h-11 min-w-11 -mr-2 flex items-center justify-center
                           text-cream/70 hover:text-gold"
              >
                <X className="w-5 h-5" aria-hidden />
              </button>
            </div>

            {q.trim() === '' ? (
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-gold-light/60 mb-3">
                  Popular
                </p>
                <div className="flex flex-wrap gap-2">
                  {popular.map((p) => (
                    <button
                      key={p}
                      onClick={() => setQ(p)}
                      className="chip"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ) : results.length === 0 ? (
              <p className="text-cream/60 py-8 text-center">
                No matches yet. Try a different word.
              </p>
            ) : (
              <ul className="divide-y divide-gold/10">
                {results.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/product/${p.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 py-3 hover:bg-gold/5 -mx-2 px-2 rounded-lg"
                    >
                      <Image
                        src={p.images[0]}
                        alt=""
                        width={56}
                        height={56}
                        className="w-14 h-14 object-cover rounded-lg bg-cream/5"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-cream truncate">{p.title}</p>
                        <p className="text-xs text-cream/50 capitalize">
                          {p.category.replace('-', ' ')} · {formatINR(p.price)}
                        </p>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-gold/60" aria-hidden />
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
