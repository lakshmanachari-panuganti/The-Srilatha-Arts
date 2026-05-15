'use client'

import { Store, Truck, CreditCard, Users, Bell, Globe } from 'lucide-react'
import Link from 'next/link'

const SETTINGS_SECTIONS = [
  {
    title: 'General',
    description: 'Store name, logo, contact info, and social links.',
    icon: Store,
    href: '/admin/settings',
    active: true,
  },
  {
    title: 'Shipping',
    description: 'Free shipping threshold, shipping rates, and delivery zones.',
    icon: Truck,
    href: '/admin/settings',
    active: false,
  },
  {
    title: 'Payments',
    description: 'Razorpay keys, COD settings, and refund policies.',
    icon: CreditCard,
    href: '/admin/settings',
    active: false,
  },
  {
    title: 'Staff & Roles',
    description: 'Admin accounts, roles, and permissions.',
    icon: Users,
    href: '/admin/settings',
    active: false,
  },
  {
    title: 'Notifications',
    description: 'WhatsApp, email, and push notification templates.',
    icon: Bell,
    href: '/admin/settings',
    active: false,
  },
  {
    title: 'Domain & SEO',
    description: 'Custom domain, meta tags, and sitemap settings.',
    icon: Globe,
    href: '/admin/settings',
    active: false,
  },
]

export default function AdminSettingsPage() {
  return (
    <div>
      <header className="mb-8">
        <h1 className="font-serif text-3xl text-ink mb-1">Settings</h1>
        <p className="text-ink-soft text-sm">Configure your store, shipping, payments, and more.</p>
      </header>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SETTINGS_SECTIONS.map((section) => {
          const Icon = section.icon
          return (
            <div
              key={section.title}
              className={`bg-plum-light border rounded-xl p-6 transition-all group ${
                section.active
                  ? 'border-ink/10 hover:border-lavender/30 hover:shadow-sm cursor-pointer'
                  : 'border-ink/5 opacity-60'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-lavender-pastel/30 flex items-center justify-center text-plum shrink-0 group-hover:bg-lavender-pastel/50 transition-colors">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-medium text-ink mb-1 group-hover:text-plum transition-colors">
                    {section.title}
                  </h3>
                  <p className="text-sm text-ink-soft leading-relaxed">{section.description}</p>
                  {!section.active && (
                    <span className="inline-block mt-2 text-xs font-medium text-ink-mute bg-paper px-2 py-0.5 rounded">
                      Coming soon
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* General Settings - inline for now */}
      <div className="mt-10">
        <h2 className="font-serif text-xl text-ink mb-4">General</h2>
        <div className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-ink-soft mb-1.5">Store Name</label>
            <input
              type="text"
              defaultValue="Srilatha Art"
              className="w-full max-w-md h-11 px-4 bg-plum border border-ink/10 rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-soft mb-1.5">Contact Email</label>
            <input
              type="email"
              defaultValue="studio@srilatha.art"
              className="w-full max-w-md h-11 px-4 bg-plum border border-ink/10 rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-soft mb-1.5">WhatsApp Number</label>
            <input
              type="tel"
              defaultValue="+91 98484 33740"
              className="w-full max-w-md h-11 px-4 bg-plum border border-ink/10 rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-soft mb-1.5">Free Shipping Threshold (₹)</label>
            <input
              type="number"
              defaultValue="2999"
              className="w-full max-w-xs h-11 px-4 bg-plum border border-ink/10 rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent transition-all"
            />
          </div>
          <div className="pt-2">
            <button className="btn-dark text-sm h-10 px-6">Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  )
}
