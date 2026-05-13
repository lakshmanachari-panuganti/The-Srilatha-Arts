import { Search, Filter, Eye } from 'lucide-react'
import { formatINR } from '@/lib/format'

// Mock data for the UI until backend is wired up in Phase 2
const MOCK_ORDERS = [
  {
    id: 'TSA-2026-00104',
    customerName: 'Aisha Sharma',
    date: '2026-05-12T14:30:00Z',
    status: 'PLACED',
    total: 350000,
    items: 2
  },
  {
    id: 'TSA-2026-00103',
    customerName: 'Rahul Verma',
    date: '2026-05-11T09:15:00Z',
    status: 'CRAFTING',
    total: 850000,
    items: 1
  },
  {
    id: 'TSA-2026-00102',
    customerName: 'Priya Patel',
    date: '2026-05-10T16:45:00Z',
    status: 'SHIPPED',
    total: 420000,
    items: 3
  },
  {
    id: 'TSA-2026-00101',
    customerName: 'Vikram Singh',
    date: '2026-05-08T11:20:00Z',
    status: 'DELIVERED',
    total: 1250000,
    items: 1
  }
]

const STATUS_COLORS: Record<string, string> = {
  PLACED: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  CONFIRMED: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  CRAFTING: 'bg-purple-50 text-purple-700 ring-purple-600/20',
  PACKED: 'bg-yellow-50 text-yellow-800 ring-yellow-600/20',
  SHIPPED: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  DELIVERED: 'bg-green-50 text-green-700 ring-green-600/20',
  CANCELLED: 'bg-red-50 text-red-700 ring-red-600/10',
}

export default function AdminOrdersPage() {
  return (
    <div>
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl text-ink mb-1">Orders</h1>
          <p className="text-ink-soft text-sm">Manage customer orders and update their status.</p>
        </div>
      </header>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-mute" />
          <input
            type="text"
            placeholder="Search orders by ID or customer..."
            className="w-full pl-10 pr-4 h-10 bg-white border border-ink/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent"
          />
        </div>
        <select className="px-4 h-10 bg-white border border-ink/10 rounded-lg text-sm text-ink hover:bg-paper transition-colors focus:outline-none focus:ring-2 focus:ring-lavender focus:border-transparent">
          <option value="ALL">All Statuses</option>
          <option value="PLACED">Placed</option>
          <option value="CRAFTING">Crafting</option>
          <option value="SHIPPED">Shipped</option>
        </select>
        <button className="flex items-center gap-2 px-4 h-10 bg-white border border-ink/10 rounded-lg text-sm text-ink hover:bg-paper transition-colors ml-auto">
          <Filter className="w-4 h-4 text-ink-mute" />
          More Filters
        </button>
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-ink/10 rounded-xl overflow-x-auto">
        <table className="w-full text-left text-sm text-ink min-w-[800px]">
          <thead className="bg-paper border-b border-ink/10 text-ink-soft font-medium">
            <tr>
              <th className="px-6 py-4">Order ID</th>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Customer</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Total</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/5">
            {MOCK_ORDERS.map((order) => (
              <tr key={order.id} className="hover:bg-lavender-pastel/10 transition-colors group">
                <td className="px-6 py-4 font-medium">
                  {order.id}
                </td>
                <td className="px-6 py-4 text-ink-soft">
                  {new Date(order.date).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric'
                  })}
                </td>
                <td className="px-6 py-4">
                  {order.customerName}
                  <span className="text-xs text-ink-mute block mt-0.5">{order.items} items</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ring-1 ring-inset ${STATUS_COLORS[order.status] || 'bg-gray-50 text-gray-700 ring-gray-600/20'}`}>
                    {order.status}
                  </span>
                </td>
                <td className="px-6 py-4 font-medium">
                  {formatINR(order.total)}
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="inline-flex items-center gap-1.5 text-sm font-medium text-terracotta hover:text-plum transition-colors">
                    <Eye className="w-4 h-4" />
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
