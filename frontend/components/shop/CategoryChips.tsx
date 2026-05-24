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
    <nav
      aria-label="Categories navigation"
      className="sticky top-24 lg:top-28 z-30 border-b border-purple-200/50"
      style={{
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <div className="chip-rail py-3 lg:py-4 max-w-6xl mx-auto lg:px-8">
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
