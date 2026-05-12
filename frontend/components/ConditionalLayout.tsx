'use client'
import { usePathname } from 'next/navigation'
import MarqueeBanner from '@/components/MarqueeBanner'
import Header from '@/components/Header'
import BottomTabBar from '@/components/BottomTabBar'
import Footer from '@/components/Footer'
import { ANNOUNCEMENTS } from '@/data/announcements'

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/'

  const isAdmin = pathname.startsWith('/admin')
  const isAuth = ['/login', '/register', '/forgot-password', '/verify-otp'].some((p) =>
    pathname.startsWith(p),
  )
  const isCheckout = pathname.startsWith('/checkout')

  const showMarquee = !isAdmin && !isCheckout && !isAuth
  const showChrome = !isAdmin && !isAuth
  const showTabs = !isAdmin && !isAuth && !isCheckout
  const showFooter = !isAdmin && !isAuth && !isCheckout

  return (
    <>
      {showMarquee && <MarqueeBanner items={ANNOUNCEMENTS.filter((a) => a.active)} />}
      {showChrome && <Header />}
      <main id="main" className="relative z-10 pb-24 lg:pb-0">
        {children}
      </main>
      {showFooter && <Footer />}
      {showTabs && <BottomTabBar />}
    </>
  )
}
