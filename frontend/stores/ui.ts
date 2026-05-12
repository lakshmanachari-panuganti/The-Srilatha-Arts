'use client'
import { create } from 'zustand'

interface UIState {
  drawerOpen: boolean
  searchOpen: boolean
  setDrawerOpen: (open: boolean) => void
  setSearchOpen: (open: boolean) => void
}

export const useUI = create<UIState>((set) => ({
  drawerOpen: false,
  searchOpen: false,
  setDrawerOpen: (open) => set({ drawerOpen: open }),
  setSearchOpen: (open) => set({ searchOpen: open }),
}))
