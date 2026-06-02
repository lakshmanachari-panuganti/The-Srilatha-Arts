'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { MessageCircle } from 'lucide-react'
import { whatsappLink } from '@/lib/site-config'

// Persistent WhatsApp shortcut. WhatsApp is the dominant contact channel for
// a handcrafted Indian D2C brand — the footer already has a link, but a
// floating CTA visible on every scroll position dramatically lowers the
// conversion threshold for "I have a question".
//
// Positioning rules:
//   - Mobile: bottom-right, lifted above the BottomTabBar (h-16 + safe-area).
//   - Desktop: bottom-right with comfortable inset.
//
// Why platform-recognisable green and not brand lavender:
//   The green disc + speech-bubble icon is universally recognised as
//   "tap to WhatsApp". Painting it lavender would hide what it does.
//   The brand still shows through the page around it.
export default function FloatingWhatsApp() {
  // Tiny stagger so it doesn't pop in the moment the page mounts — same
  // editorial rhythm as the rest of the hero motion.
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 800)
    return () => clearTimeout(t)
  }, [])

  // PDP and cart show a sticky CTA bar (StickyCartBar, h-~16 on mobile) above
  // the BottomTabBar. Without lifting the FAB, it sits on top of the Buy-now
  // button. Route check is cheap and avoids a global layout context.
  const pathname = usePathname() || '/'
  const hasStickyCartBar =
    pathname.startsWith('/product/') || pathname === '/cart'

  return (
    <a
      href={whatsappLink("Hi Srilatha Art, I'd like to ask about a piece I saw on the site.")}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className={[
        'fixed z-40 flex items-center justify-center',
        'h-14 w-14 lg:h-16 lg:w-16',
        'right-4 lg:right-6',
        // Mobile bottom offset:
        //   - default: BottomTabBar (h-16) + safe-area + breathing room
        //   - PDP / cart: also clear the StickyCartBar (~h-16) sitting above it
        // Desktop: tab bar is hidden, normal bottom inset.
        hasStickyCartBar
          ? 'bottom-[calc(9rem+env(safe-area-inset-bottom))] lg:bottom-8'
          : 'bottom-[calc(5rem+env(safe-area-inset-bottom))] lg:bottom-8',
        'rounded-full text-white',
        'transition-all duration-500',
        visible ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none',
        'hover:scale-105 active:scale-95',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400/40',
      ].join(' ')}
      style={{
        background: 'linear-gradient(135deg, var(--wa-1) 0%, var(--wa-2) 100%)',
        boxShadow:
          '0 10px 30px -8px rgba(18,140,126,0.55), 0 0 0 4px rgba(37,211,102,0.18)',
      }}
    >
      {/* Soft pulsing halo — pure CSS, respects prefers-reduced-motion via
          the global rule in globals.css that flattens animation durations. */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-full animate-glow-pulse"
        style={{
          background:
            'radial-gradient(circle at center, rgba(37,211,102,0.45) 0%, transparent 70%)',
          filter: 'blur(8px)',
        }}
      />
      <MessageCircle className="relative w-6 h-6 lg:w-7 lg:h-7" aria-hidden />
    </a>
  )
}
