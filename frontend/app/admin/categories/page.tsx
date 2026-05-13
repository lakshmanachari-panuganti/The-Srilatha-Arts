'use client'

import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react'
import { CATEGORIES } from '@/data/categories'

export default function AdminCategoriesPage() {
  return (
    <div>
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl text-ink mb-1">Categories</h1>
          <p className="text-ink-soft text-sm">Manage art form categories. Drag to reorder.</p>
        </div>
        <button className="btn-dark text-sm h-10 px-4 shrink-0 self-start sm:self-auto">
          <Plus className="w-4 h-4 mr-2" />
          Add Category
        </button>
      </header>

      <div className="space-y-3">
        {CATEGORIES.map((cat) => (
          <div
            key={cat.slug}
            className="bg-plum-light border border-ink/10 rounded-xl p-4 md:p-5 flex items-center gap-4 hover:border-lavender/30 transition-colors group"
          >
            <GripVertical className="w-4 h-4 text-ink-mute cursor-grab shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-10 h-10 rounded-lg bg-lavender-pastel/20 shrink-0 flex items-center justify-center">
              <span className="text-sm font-bold text-plum">{cat.ordinal}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-ink">{cat.title}</h3>
              <p className="text-sm text-ink-soft truncate">{cat.tagline}</p>
            </div>
            <code className="hidden md:inline text-xs text-ink-mute bg-paper px-2 py-1 rounded">{cat.slug}</code>
            <div className="flex items-center gap-2 shrink-0">
              <button className="text-ink-mute hover:text-plum transition-colors p-1" title="Edit">
                <Pencil className="w-4 h-4" />
              </button>
              <button className="text-ink-mute hover:text-red-600 transition-colors p-1" title="Delete">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
