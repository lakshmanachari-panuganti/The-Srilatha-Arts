'use client'
import { usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import MarqueeBanner from '@/components/MarqueeBanner'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import FloatingWhatsApp from '@/components/FloatingWhatsApp'
import Toaster from '@/components/Toaster'
import { apiFetch } from '@/lib/api'
import { ANNOUNCEMENTS } from '@/data/announcements'
import type { Announcement } from '@/types'

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/'

  const isAdmin = pathname.startsWith('/admin')
  const isAuth = ['/login', '/register', '/forgot-password', '/verify-otp'].some((p) =>
    pathname.startsWith(p),
  )
  const isCheckout = pathname.startsWith('/checkout')

  const showMarquee = !isAdmin && !isCheckout && !isAuth
  const showChrome = !isAdmin && !isAuth
  const showFooter = !isAdmin && !isAuth && !isCheckout
  // Floating WhatsApp: same gating as footer - anywhere the user is shopping
  // or browsing. Hidden in checkout (don't interrupt payment), admin, auth.
  const showWhatsApp = showFooter

  const { data: apiData } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => apiFetch<{ announcements: Announcement[] }>('/announcements'),
    enabled: showMarquee,
    staleTime: 5 * 60_000,
  })

  // Use live announcements from backend; fall back to static data if backend returns empty
  const announcements =
    (apiData?.announcements?.length ?? 0) > 0
      ? apiData!.announcements.filter((a) => a.active)
      : ANNOUNCEMENTS.filter((a) => a.active)

  return (
    <>
      {showMarquee && <MarqueeBanner items={announcements} />}
      {showChrome && <Header />}
      <main id="main" className="relative z-10">
        {children}
      </main>
      {showFooter && <Footer />}
      {showWhatsApp && <FloatingWhatsApp />}
      {/* Toaster lives outside the route boundary so a toast announced just
          before a navigation (e.g. "Redirecting to login…") keeps rendering
          on the next page. Cheap when there are no active toasts. */}
      <Toaster />
    </>
  )
}
