'use client'
import { cn } from '@/lib/cn'

export default function KolamLoader({
  fullScreen = false,
  label = 'Loading',
}: {
  fullScreen?: boolean
  label?: string
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn(
        'flex flex-col items-center justify-center gap-4',
        fullScreen ? 'min-h-svh' : 'py-14',
      )}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-20 h-20 text-terracotta"
        style={{ animation: 'spin 6s linear infinite' }}
        aria-hidden
      >
        {Array.from({ length: 8 }).map((_, i) => {
          const angle = (i / 8) * Math.PI * 2
          const x = 50 + Math.cos(angle) * 30
          const y = 50 + Math.sin(angle) * 30
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="3"
              fill="currentColor"
              opacity={0.3 + (i / 8) * 0.7}
            />
          )
        })}
        <circle cx="50" cy="50" r="5" fill="currentColor" />
        <circle
          cx="50"
          cy="50"
          r="34"
          stroke="currentColor"
          strokeWidth="1"
          fill="none"
          strokeDasharray="4 6"
          opacity="0.4"
        />
      </svg>
      <p className="text-ink-mute text-sm tracking-wide">{label}</p>
    </div>
  )
}
