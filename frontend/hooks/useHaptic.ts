'use client'

export function useHaptic() {
  return (pattern: number | number[] = 15) => {
    if (typeof window === 'undefined') return
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(pattern)
      } catch {
        // silent
      }
    }
  }
}
