'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/cn'
import { CATEGORIES } from '@/data/categories'

const chips = [
  { href: '/shop', label: 'All' },
  ...CATEGORIES.map((c) => ({ href: `/shop/${c.slug}`, label: c.title })),
  { href: '/new-arrivals', label: 'New' },
  { href: '/sale', label: 'Sale' },
] as const

export default function CategoryChips() {
  const pathname = usePathname() || '/'

  return (
    <nav aria-label="Categories" className="sticky top-[calc(var(--banner-h)+3.5rem)] lg:top-[calc(var(--banner-h)+4rem)] z-30 bg-primary-dark/80 backdrop-blur-xl border-b border-gold/10">
      <div className="chip-rail py-3 lg:py-4 max-w-7xl mx-auto lg:px-8">
        {chips.map((c) => {
          const active =
            c.href === '/shop'
              ? pathname === '/shop'
              : pathname === c.href || pathname.startsWith(c.href + '/')
          return (
            <Link
              key={c.href}
              href={c.href}
              aria-current={active ? 'page' : undefined}
              className={cn('chip', active && 'is-active')}
            >
              {c.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
