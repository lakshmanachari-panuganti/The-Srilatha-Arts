'use client'
import { useEffect, useState } from 'react'

export type ScrollDir = 'up' | 'down' | null

export function useScrollDirection(threshold = 6): ScrollDir {
  const [dir, setDir] = useState<ScrollDir>(null)

  useEffect(() => {
    let last = window.scrollY
    let ticking = false

    const onScroll = () => {
      const current = window.scrollY
      if (Math.abs(current - last) < threshold) {
        ticking = false
        return
      }
      setDir(current > last ? 'down' : 'up')
      last = current > 0 ? current : 0
      ticking = false
    }

    const handler = () => {
      if (!ticking) {
        window.requestAnimationFrame(onScroll)
        ticking = true
      }
    }

    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [threshold])

  return dir
}
