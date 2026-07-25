'use client'

import { Plus, Pencil, Trash2, Eye, Package } from 'lucide-react'

const MOCK_COLLECTIONS = [
  { id: 'diwali-2026', title: 'Diwali Collection 2026', slug: 'diwali-2026', itemCount: 0, active: false, createdAt: '2026-05-10T10:00:00Z' },
  { id: 'wedding-gifts', title: 'Wedding Gifting', slug: 'wedding-gifts', itemCount: 0, active: true, createdAt: '2026-04-15T10:00:00Z' },
  { id: 'housewarming', title: 'Housewarming Favorites', slug: 'housewarming', itemCount: 0, active: true, createdAt: '2026-03-20T10:00:00Z' },
]

export default function AdminCollectionsPage() {
  return (
    <div>
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl text-ink mb-1">Collections</h1>
          <p className="text-ink-soft text-sm">Curated bundles of artworks for special occasions.</p>
        </div>
        <button className="btn-dark text-sm h-10 px-4 shrink-0 self-start sm:self-auto">
          <Plus className="w-4 h-4 mr-2" />
          New Collection
        </button>
      </header>

      <div className="space-y-4">
        {MOCK_COLLECTIONS.map((col) => (
          <div
            key={col.id}
            className={`bg-plum-light border rounded-lg p-4 md:p-6 transition-colors ${
              col.active ? 'border-ink/10 hover:border-lavender/30' : 'border-ink/5 opacity-60'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="font-medium text-ink">{col.title}</h3>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset ${
                    col.active
                      ? 'bg-green-50 text-green-700 ring-green-600/20'
                      : 'bg-gray-50 text-gray-600 ring-gray-500/20'
                  }`}>
                    {col.active ? 'Active' : 'Draft'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-ink-mute">
                  <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {col.itemCount} products</span>
                  <code className="bg-paper px-1.5 py-0.5 rounded">/{col.slug}</code>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button className="text-ink-mute hover:text-plum transition-colors p-1.5" title="Preview">
                  <Eye className="w-4 h-4" />
                </button>
                <button className="text-ink-mute hover:text-plum transition-colors p-1.5" title="Edit">
                  <Pencil className="w-4 h-4" />
                </button>
                <button className="text-ink-mute hover:text-red-600 transition-colors p-1.5" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
