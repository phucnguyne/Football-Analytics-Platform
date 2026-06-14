import { create } from 'zustand'
import type { Match } from '../types/TypesBarrel'

interface LiveState {
  liveMatches: Match[]
  setLive:     (matches: Match[]) => void
  updateScore: (matchId: string, home: number, away: number) => void
}

export const useLiveStore = create<LiveState>((set) => ({
  liveMatches: [],

  setLive: (matches) => set({ liveMatches: matches }),

  updateScore: (matchId, home, away) =>
    set((s) => ({
      liveMatches: s.liveMatches.map((m) =>
        m.id === matchId
          ? { ...m, score: { ...m.score, homeTeamGoals: home, awayTeamGoals: away } }
          : m
      ),
    })),
}))