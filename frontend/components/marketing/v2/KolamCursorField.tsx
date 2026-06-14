'use client'

/**
 * KolamCursorField — signature interactive backdrop.
 *
 * A living dot-lace pattern rooted in South Indian kolam tradition.
 * The cursor "draws" gold light through it: nearby dots wake up, trace
 * luminous threads to their neighbours, and a short trail of gold dust
 * follows the pointer before fading like sand. On touch devices, finger
 * drag drives the same field; on idle, the pattern breathes at a low
 * amplitude so the section never feels static.
 *
 * Design intent:
 *   - Use the visual language of the craft (dot grid + connecting lines)
 *     as interaction, not generic particles. This is the wow moment.
 *   - Run inside the existing ivory/ink/gold palette — gold leaf on dark
 *     scrim — so it composes against any room background.
 *   - Stay cheap: Canvas2D, single rAF, intersection-paused, DPR-aware,
 *     prefers-reduced-motion freezes to a static dot grid.
 *
 * The component absolutely positions a <canvas> that fills its parent.
 * The parent must be `position: relative` (or absolute) for layout.
 */

import { useEffect, useRef } from 'react'

interface KolamCursorFieldProps {
  /** Spacing between dots in CSS pixels. Lower = denser, more expensive. */
  density?: number
  /** Radius in CSS pixels around the cursor that "wakes" dots. */
  interactionRadius?: number
  /** Base dot colour (rgba string). */
  dotColor?: string
  /** Cursor-active dot / line colour (rgba string — alpha is animated). */
  goldColor?: string
  /** Optional className for the wrapper. */
  className?: string
  /** Cap on dust particle count to keep paint cost bounded. */
  maxParticles?: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
}

export default function KolamCursorField({
  density = 28,
  interactionRadius = 150,
  dotColor = 'rgba(250, 204, 21, 0.20)',
  goldColor = '250, 204, 21',
  className,
  maxParticles = 28,
}: KolamCursorFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvasNullable = canvasRef.current
    const wrapperNullable = wrapperRef.current
    if (!canvasNullable || !wrapperNullable) return

    const ctxNullable = canvasNullable.getContext('2d', { alpha: true })
    if (!ctxNullable) return

    // Rebind to non-null locals — TS strict won't propagate the early-return
    // narrowing into the nested rAF / event-handler closures defined below.
    const canvas = canvasNullable
    const wrapper = wrapperNullable
    const ctx = ctxNullable

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    // Pointer state lives in refs (not React state) so updates don't trigger
    // re-renders — the animation loop reads them directly each frame.
    const pointer = { x: -9999, y: -9999, active: false }
    const particles: Particle[] = []
    let dots: { x: number; y: number; phase: number }[] = []
    let width = 0
    let height = 0
    let rafId = 0
    let running = true
    let lastSpawnAt = 0
    let lastFrameAt = performance.now()

    function rebuildGrid() {
      const rect = wrapper.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Centered grid — inset by half a cell so the pattern doesn't clip
      // at the edges.
      const cols = Math.ceil(width / density) + 2
      const rows = Math.ceil(height / density) + 2
      const offsetX = (width - (cols - 1) * density) / 2
      const offsetY = (height - (rows - 1) * density) / 2

      const next: typeof dots = []
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          next.push({
            x: offsetX + c * density,
            y: offsetY + r * density,
            // Phase varies per dot so the idle breathing isn't a wave.
            phase: Math.random() * Math.PI * 2,
          })
        }
      }
      dots = next
    }

    function onPointerMove(e: PointerEvent) {
      const rect = wrapper.getBoundingClientRect()
      pointer.x = e.clientX - rect.left
      pointer.y = e.clientY - rect.top
      pointer.active = true
    }

    function onPointerLeave() {
      pointer.active = false
      pointer.x = -9999
      pointer.y = -9999
    }

    function spawnDust(x: number, y: number, count: number) {
      for (let i = 0; i < count && particles.length < maxParticles; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 0.4 + Math.random() * 0.9
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.2, // bias upward — feels like dust
          life: 0,
          maxLife: 900 + Math.random() * 700,
        })
      }
    }

    function draw(now: number) {
      if (!running) return
      const dt = Math.min(48, now - lastFrameAt)
      lastFrameAt = now

      ctx.clearRect(0, 0, width, height)

      // Spawn trail particles while cursor is active, throttled by frame.
      if (pointer.active && now - lastSpawnAt > 24) {
        spawnDust(pointer.x, pointer.y, 2)
        lastSpawnAt = now
      }

      // Pass 1 — dots. Compute proximity-driven brightness; if active,
      // also draw connecting strokes to neighbours within range.
      const r2 = interactionRadius * interactionRadius
      ctx.lineWidth = 0.75

      for (let i = 0; i < dots.length; i++) {
        const d = dots[i]!
        const dx = d.x - pointer.x
        const dy = d.y - pointer.y
        const dist2 = dx * dx + dy * dy

        // Idle breathing — tiny radius oscillation, very subtle.
        const breathe = 0.85 + 0.15 * Math.sin(now * 0.0008 + d.phase)
        let radius = 0.9 * breathe
        let useGold = false

        if (pointer.active && dist2 < r2) {
          const t = 1 - dist2 / r2 // 0..1, 1 nearest
          const eased = t * t
          radius = 0.9 + eased * 2.6
          useGold = true

          // Connect to a few neighbours — limit to N to bound work.
          // Strong only for very-near dots, fades with distance.
          if (eased > 0.3) {
            for (let j = i + 1; j < Math.min(i + 6, dots.length); j++) {
              const n = dots[j]!
              const ndx = n.x - d.x
              const ndy = n.y - d.y
              const nd2 = ndx * ndx + ndy * ndy
              // Only connect to immediate grid neighbours (~density*1.5).
              if (nd2 < density * density * 2.25) {
                const alpha = eased * 0.55
                ctx.strokeStyle = `rgba(${goldColor}, ${alpha.toFixed(3)})`
                ctx.beginPath()
                ctx.moveTo(d.x, d.y)
                ctx.lineTo(n.x, n.y)
                ctx.stroke()
              }
            }
          }
        }

        ctx.fillStyle = useGold
          ? `rgba(${goldColor}, ${(0.35 + Math.min(1, radius / 3) * 0.55).toFixed(3)})`
          : dotColor
        ctx.beginPath()
        ctx.arc(d.x, d.y, radius, 0, Math.PI * 2)
        ctx.fill()
      }

      // Pass 2 — dust particles. Simple integrator + fade.
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]!
        p.life += dt
        if (p.life >= p.maxLife) {
          particles.splice(i, 1)
          continue
        }
        // Gentle viscous decay — gold dust on a still day.
        p.x += p.vx * (dt / 16)
        p.y += p.vy * (dt / 16)
        p.vx *= 0.985
        p.vy *= 0.985
        p.vy += 0.005 * (dt / 16) // tiny gravity bias
        const lifeT = p.life / p.maxLife
        const alpha = (1 - lifeT) * 0.7
        const r = 1.4 * (1 - lifeT * 0.4)
        ctx.fillStyle = `rgba(${goldColor}, ${alpha.toFixed(3)})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        ctx.fill()
      }

      rafId = requestAnimationFrame(draw)
    }

    rebuildGrid()

    if (reduceMotion) {
      // Render the dot grid once, static — no rAF, no listeners.
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = dotColor
      for (const d of dots) {
        ctx.beginPath()
        ctx.arc(d.x, d.y, 0.9, 0, Math.PI * 2)
        ctx.fill()
      }
      return () => {}
    }

    // Pointer listeners on the wrapper so the field only reacts within
    // its section — not when the user is interacting elsewhere on the page.
    wrapper.addEventListener('pointermove', onPointerMove, { passive: true })
    wrapper.addEventListener('pointerleave', onPointerLeave, { passive: true })

    const resizeObs = new ResizeObserver(() => rebuildGrid())
    resizeObs.observe(wrapper)

    // Pause the animation loop while the section is off-screen — avoids
    // burning paint budget when the user has scrolled past.
    const intersectObs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) return
        if (entry.isIntersecting && !running) {
          running = true
          lastFrameAt = performance.now()
          rafId = requestAnimationFrame(draw)
        } else if (!entry.isIntersecting && running) {
          running = false
          cancelAnimationFrame(rafId)
        }
      },
      { threshold: 0 },
    )
    intersectObs.observe(wrapper)

    rafId = requestAnimationFrame(draw)

    return () => {
      running = false
      cancelAnimationFrame(rafId)
      wrapper.removeEventListener('pointermove', onPointerMove)
      wrapper.removeEventListener('pointerleave', onPointerLeave)
      resizeObs.disconnect()
      intersectObs.disconnect()
    }
  }, [density, interactionRadius, dotColor, goldColor, maxParticles])

  return (
    <div
      ref={wrapperRef}
      aria-hidden
      className={
        'pointer-events-auto absolute inset-0 z-[1] ' + (className ?? '')
      }
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  )
}
