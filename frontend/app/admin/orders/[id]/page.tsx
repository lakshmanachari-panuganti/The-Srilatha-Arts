'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ChevronRight, Package, Truck, Clock, Phone, Mail, MapPin, MessageSquare, Send } from 'lucide-react'
import { formatINR, formatDate } from '@/lib/format'

type OrderStatus = 'PLACED' | 'CONFIRMED' | 'CRAFTING' | 'PACKED' | 'SHIPPED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED' | 'ON_HOLD' | 'RETURN_REQUESTED' | 'RETURNED' | 'REFUNDED'

const STATUS_COLORS: Record<string, string> = {
  PLACED: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  CONFIRMED: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  CRAFTING: 'bg-purple-50 text-purple-700 ring-purple-600/20',
  PACKED: 'bg-yellow-50 text-yellow-800 ring-yellow-600/20',
  SHIPPED: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  OUT_FOR_DELIVERY: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  DELIVERED: 'bg-green-50 text-green-700 ring-green-600/20',
  CANCELLED: 'bg-red-50 text-red-700 ring-red-600/10',
  ON_HOLD: 'bg-gray-50 text-gray-700 ring-gray-600/20',
  RETURN_REQUESTED: 'bg-pink-50 text-pink-700 ring-pink-600/20',
  RETURNED: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  REFUNDED: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
}

// Mock order data
const MOCK_ORDER = {
  id: 'TSA-2026-00104',
  status: 'CRAFTING' as OrderStatus,
  paymentStatus: 'PAID',
  customerName: 'Aisha Sharma',
  customerEmail: 'aisha@example.com',
  customerPhone: '+91 98765 43210',
  shippingAddress: {
    line1: '42, Jubilee Hills',
    line2: 'Road No. 5',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500033',
  },
  items: [
    { productId: 'mandala-aurora-12', title: 'Aurora Dot Mandala - 12" Round', category: 'dot-mandala', price: 4200, qty: 1, imageUrl: '/images/logo.png' },
    { productId: 'resin-cosmos-coasters-4', title: 'Cosmos Resin Coasters (Set of 4)', category: 'resin', price: 1450, qty: 1, imageUrl: '/images/logo.png' },
  ],
  subtotal: 565000,
  shippingAmount: 0,
  discountAmount: 169500,
  couponCode: 'SRILATHA30',
  displayTotal: 3955,
  createdAt: '2026-05-12T14:30:00Z',
  updatedAt: '2026-05-13T08:15:00Z',
}

const MOCK_EVENTS = [
  { id: '1', toStatus: 'PLACED', by: 'Customer', note: 'Order placed', createdAt: '2026-05-12T14:30:00Z' },
  { id: '2', fromStatus: 'PLACED', toStatus: 'CONFIRMED', by: 'admin', note: 'Payment verified', createdAt: '2026-05-12T15:00:00Z' },
  { id: '3', fromStatus: 'CONFIRMED', toStatus: 'CRAFTING', by: 'admin', note: 'Started crafting mandala', createdAt: '2026-05-13T08:15:00Z' },
]

const NEXT_STATES = [
  { status: 'PACKED', label: 'Packed' },
  { status: 'CANCELLED', label: 'Cancelled' },
  { status: 'ON_HOLD', label: 'On Hold' },
]

export default function AdminOrderDetailPage() {
  const params = useParams()
  const [note, setNote] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const order = MOCK_ORDER

  return (
    <div>
      {/* Back + Header */}
      <div className="mb-6">
        <Link href="/admin/orders" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-plum mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Orders
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl md:text-3xl text-ink mb-1">{order.id}</h1>
            <p className="text-sm text-ink-soft">Placed {formatDate(order.createdAt)}</p>
          </div>
          <span className={`self-start inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium ring-1 ring-inset ${STATUS_COLORS[order.status]}`}>
            {order.status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items */}
          <div className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-6">
            <h2 className="font-serif text-lg text-ink mb-4">Items</h2>
            <div className="divide-y divide-ink/5">
              {order.items.map((item) => (
                <div key={item.productId} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="w-14 h-14 rounded-lg bg-cream-deep border border-ink/5 shrink-0 flex items-center justify-center">
                    <Package className="w-6 h-6 text-ink-mute" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-ink text-sm truncate">{item.title}</p>
                    <p className="text-xs text-ink-mute capitalize">{item.category.replace('-', ' ')} · Qty: {item.qty}</p>
                  </div>
                  <p className="font-medium text-ink text-sm shrink-0">{formatINR(item.price)}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-ink/10 mt-4 pt-4 space-y-1.5 text-sm">
              <div className="flex justify-between text-ink-soft"><span>Subtotal</span><span>{formatINR(order.subtotal / 100)}</span></div>
              <div className="flex justify-between text-ink-soft"><span>Shipping</span><span>{order.shippingAmount === 0 ? 'FREE' : formatINR(order.shippingAmount / 100)}</span></div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-green-700"><span>Discount ({order.couponCode})</span><span>−{formatINR(order.discountAmount / 100)}</span></div>
              )}
              <div className="flex justify-between font-medium text-ink text-base pt-1 border-t border-ink/5"><span>Total</span><span>{formatINR(order.displayTotal)}</span></div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-6">
            <h2 className="font-serif text-lg text-ink mb-4">Activity Timeline</h2>
            <div className="space-y-0">
              {MOCK_EVENTS.map((event, i) => (
                <div key={event.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full shrink-0 mt-1.5 ${i === MOCK_EVENTS.length - 1 ? 'bg-lavender ring-4 ring-lavender/20' : 'bg-green-500'}`} />
                    {i < MOCK_EVENTS.length - 1 && <div className="w-px flex-1 bg-ink/10 my-1" />}
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-medium text-ink">{event.toStatus.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-ink-mute">{event.note}</p>
                    <p className="text-xs text-ink-mute mt-0.5">{new Date(event.createdAt).toLocaleString('en-IN')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Status Update */}
          <div className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-6">
            <h2 className="font-serif text-lg text-ink mb-4">Update Status</h2>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="flex-1 h-11 px-4 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender"
              >
                <option value="">Select next status...</option>
                {NEXT_STATES.map((s) => (
                  <option key={s.status} value={s.status}>{s.label}</option>
                ))}
              </select>
              <button className="btn-dark text-sm h-11 px-6 shrink-0" disabled={!selectedStatus}>
                <Send className="w-4 h-4 mr-2" />
                Update
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-soft mb-1.5">Internal Note</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Add a note (visible only to admins)..."
                className="w-full px-4 py-3 bg-plum border border-ink/10 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender resize-none"
              />
            </div>
          </div>
        </div>

        {/* Right column — Sidebar */}
        <div className="space-y-6">
          {/* Customer */}
          <div className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-6">
            <h2 className="font-serif text-lg text-ink mb-3">Customer</h2>
            <p className="font-medium text-ink mb-2">{order.customerName}</p>
            <div className="space-y-2 text-sm text-ink-soft">
              <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" />{order.customerEmail}</div>
              <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" />{order.customerPhone}</div>
            </div>
          </div>

          {/* Shipping */}
          <div className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-6">
            <h2 className="font-serif text-lg text-ink mb-3">Shipping Address</h2>
            <div className="flex items-start gap-2 text-sm text-ink-soft">
              <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <div>
                <p>{order.shippingAddress.line1}</p>
                {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.pincode}</p>
              </div>
            </div>
          </div>

          {/* Payment */}
          <div className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-6">
            <h2 className="font-serif text-lg text-ink mb-3">Payment</h2>
            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20">
              {order.paymentStatus}
            </span>
          </div>

          {/* Quick Actions */}
          <div className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-6">
            <h2 className="font-serif text-lg text-ink mb-3">Quick Actions</h2>
            <div className="space-y-2">
              <button className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-ink-soft hover:text-plum hover:bg-lavender-pastel/10 rounded-lg transition-colors">
                <MessageSquare className="w-4 h-4" /> Send WhatsApp
              </button>
              <button className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-ink-soft hover:text-plum hover:bg-lavender-pastel/10 rounded-lg transition-colors">
                <Mail className="w-4 h-4" /> Send Email
              </button>
              <button className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-ink-soft hover:text-plum hover:bg-lavender-pastel/10 rounded-lg transition-colors">
                <Truck className="w-4 h-4" /> Add Tracking
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
