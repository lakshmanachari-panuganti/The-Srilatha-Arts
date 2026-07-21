'use client'

import { useState } from 'react'
import { Upload, Search, Image as ImageIcon, Trash2, FolderOpen, ExternalLink } from 'lucide-react'
import { formatDate } from '@/lib/format'

const MOCK_MEDIA = [
  { id: '1', name: 'hero-banner.jpg', url: 'https://images.unsplash.com/photo-1605721911519-3dfeb3be25e7?w=800&q=80', size: '2.4 MB', type: 'image/jpeg', uploadedAt: '2026-05-01T10:00:00Z' },
  { id: '2', name: 'ganesha-oil.jpg', url: 'https://images.unsplash.com/photo-1599839619722-39751411ea63?w=800&q=80', size: '1.1 MB', type: 'image/jpeg', uploadedAt: '2026-05-02T14:30:00Z' },
  { id: '3', name: 'mandala-sketch.png', url: 'https://images.unsplash.com/photo-1600170035032-411a12023bb9?w=800&q=80', size: '3.5 MB', type: 'image/png', uploadedAt: '2026-05-05T09:15:00Z' },
]

export default function AdminMediaPage() {
  const [search, setSearch] = useState('')

  return (
    <div>
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-plum-900 font-serif">Media Library</h1>
          <p className="text-sm text-plum-600/80 mt-1">Manage product images and site assets</p>
        </div>
        <button className="btn-dark flex items-center gap-2">
          <Upload className="w-4 h-4" />
          <span>Upload Files</span>
        </button>
      </header>

      <div className="card-cream mb-8">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-plum-400" />
            <input
              type="text"
              placeholder="Search files..."
              className="w-full pl-9 pr-4 py-2 bg-white/50 border border-plum-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-plum-500/20"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-plum-50 rounded-lg border border-plum-100 text-plum-700">
            <FolderOpen className="w-4 h-4" />
            <span className="text-sm font-medium">All Media</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        <div className="relative group aspect-square rounded-lg border-2 border-dashed border-plum-200 hover:border-plum-400 hover:bg-plum-50/50 transition-colors flex flex-col items-center justify-center cursor-pointer">
          <div className="w-10 h-10 rounded-full bg-plum-100 text-plum-600 flex items-center justify-center mb-2">
            <Upload className="w-5 h-5" />
          </div>
          <p className="text-sm font-medium text-plum-900">Upload</p>
          <p className="text-xs text-plum-500 mt-1 text-center px-4">Drag & drop or click</p>
        </div>

        {MOCK_MEDIA.map((item) => (
          <div key={item.id} className="group relative aspect-square rounded-lg overflow-hidden bg-plum-50 border border-plum-100">
            <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
            
            <div className="absolute inset-0 bg-plum-900/60 opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-between">
              <div className="flex justify-end gap-2">
                <button className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white backdrop-blur-sm transition-colors" title="Copy URL">
                  <ExternalLink className="w-4 h-4" />
                </button>
                <button className="p-1.5 bg-red-500/80 hover:bg-red-500 rounded-lg text-white backdrop-blur-sm transition-colors" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div>
                <p className="text-white text-sm font-medium truncate" title={item.name}>{item.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-white/70 text-xs">{item.size}</p>
                  <span className="w-1 h-1 rounded-full bg-white/30" />
                  <p className="text-white/70 text-xs">{formatDate(item.uploadedAt)}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
