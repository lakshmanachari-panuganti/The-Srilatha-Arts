'use client'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { formatINR } from '@/lib/format'

interface ActiveCoupon {
  code: string
  type: 'percent' | 'flat'
  value: number
  description?: string
  minOrderAmount?: number
}

// Loads the current valid promo codes from GET /api/coupons/active so the
// studio can rotate codes without a frontend deploy. Renders nothing if
// nothing's active - better than showing a stale hardcoded code.
export default function SaleCoupons() {
  const { data, isLoading } = useQuery({
    queryKey: ['coupons', 'active'],
    queryFn: () => apiFetch<{ coupons: ActiveCoupon[] }>('/coupons/active'),
    staleTime: 5 * 60_000,
    retry: false,
  })

  if (isLoading) {
    return <p className="text-ink-soft text-sm mt-3 animate-pulse">Checking for promos…</p>
  }
  const coupons = data?.coupons || []
  if (coupons.length === 0) {
    return (
      <p className="text-ink-soft text-sm mt-3">
        These pieces are already at special prices - no extra code needed.
      </p>
    )
  }

  return (
    <ul className="text-ink-soft text-sm mt-3 space-y-1.5">
      {coupons.map((c) => (
        <li key={c.code}>
          Use the code{' '}
          <span className="font-mono bg-paper border border-ink/15 px-2 py-0.5 rounded text-lavender">
            {c.code}
          </span>{' '}
          at checkout for {describe(c)}.
          {c.minOrderAmount ? <> Min order {formatINR(c.minOrderAmount)}.</> : null}
          {c.description ? <> {c.description}</> : null}
        </li>
      ))}
    </ul>
  )
}

function describe(c: ActiveCoupon): string {
  if (c.type === 'percent') return `${c.value}% off`
  return `${formatINR(c.value)} off`
}
