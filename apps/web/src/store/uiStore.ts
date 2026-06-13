import { create } from 'zustand'

interface UIState {
  sidebarOpen:    boolean
  selectedLeague: string
  toggleSidebar:  () => void
  setLeague:      (id: string) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen:    false,
  selectedLeague: '133', 
  toggleSidebar:  () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setLeague:      (id) => set({ selectedLeague: id }),
}))