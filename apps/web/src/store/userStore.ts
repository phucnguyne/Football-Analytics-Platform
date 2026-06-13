import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, FavType } from '../types/TypesBarrel'

interface UserState {
  user:           User | null
  favorites:      { type: FavType; id: string }[]
  setUser:        (user: User | null) => void
  addFavorite:    (type: FavType, id: string) => void
  removeFavorite: (type: FavType, id: string) => void
  isFavorite:     (type: FavType, id: string) => boolean
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user:      null,
      favorites: [],

      setUser: (user) => set({ user }),

      addFavorite: (type, id) =>
        set((s) => ({ favorites: [...s.favorites, { type, id }] })),

      removeFavorite: (type, id) =>
        set((s) => ({
          favorites: s.favorites.filter((f) => !(f.type === type && f.id === id)),
        })),

      isFavorite: (type, id) =>
        get().favorites.some((f) => f.type === type && f.id === id),
    }),
    { name: 'football-user-store' }
  )
)