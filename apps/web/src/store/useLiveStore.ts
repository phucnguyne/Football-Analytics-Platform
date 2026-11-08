import { create } from 'zustand'
import { toast } from 'react-hot-toast'

export interface LiveMatchUpdate {
  matchId: number
  status: string
  minute: number | null
  homeTeamId: number
  homeTeamName: string
  homeTeamCrest: string | null
  homeTeamShortName: string
  awayTeamId: number
  awayTeamName: string
  awayTeamCrest: string | null
  awayTeamShortName: string
  homeGoals: number | null
  awayGoals: number | null
  competition: string
  matchday: number | null
}

interface LiveStoreState {
  liveMatches: Record<number, LiveMatchUpdate>
  isConnected: boolean
  isInitializing: boolean
  connect: () => Promise<void>
  disconnect: () => void
}

let eventSource: EventSource | null = null;
let connectionGeneration = 0;
let connectPromise: Promise<void> | null = null;

export const useLiveStore = create<LiveStoreState>((set, get) => ({
  liveMatches: {},
  isConnected: false,
  isInitializing: true,

  connect: async () => {
    if (eventSource) return;
    if (connectPromise) return connectPromise;

    const generation = connectionGeneration;
    const connecting = (async () => {
      if (get().isInitializing) {
        try {
          const res = await fetch('/api/matches?status=IN_PLAY,PAUSED');
          if (!res.ok) throw new Error(`Failed to load live matches (${res.status})`);
          const data = await res.json();
          const initialMap: Record<number, LiveMatchUpdate> = {};
          data.matches?.forEach((m: any) => {
            initialMap[m.id] = {
              matchId: m.id,
              status: m.status,
              minute: m.minute ?? null,
              homeTeamId: m.homeTeam.id,
              homeTeamName: m.homeTeam.name,
              homeTeamCrest: m.homeTeam.crest,
              homeTeamShortName: m.homeTeam.shortName,
              awayTeamId: m.awayTeam.id,
              awayTeamName: m.awayTeam.name,
              awayTeamCrest: m.awayTeam.crest,
              awayTeamShortName: m.awayTeam.shortName,
              homeGoals: m.score?.fullTime?.home ?? null,
              awayGoals: m.score?.fullTime?.away ?? null,
              competition: m.competition?.name ?? '',
              matchday: m.matchday ?? null,
            };
          });
          if (generation === connectionGeneration) set({ liveMatches: initialMap });
        } catch (err) {
          if (generation === connectionGeneration) {
            console.error('Failed to fetch initial matches', err);
          }
        } finally {
          if (generation === connectionGeneration) set({ isInitializing: false });
        }
      }

      if (generation !== connectionGeneration) return;

      eventSource = new EventSource('/api/live/stream')

      eventSource.onopen = () => {
        if (generation === connectionGeneration) set({ isConnected: true })
      }

      eventSource.onmessage = (event) => {
        try {
          const updates: LiveMatchUpdate[] = JSON.parse(event.data)
          const prev = get().liveMatches;
          const next = { ...prev };

          updates.forEach((update) => {
            const oldMatch = prev[update.matchId];

            if (oldMatch) {
              if (
                update.homeGoals !== null &&
                oldMatch.homeGoals !== null &&
                update.homeGoals > oldMatch.homeGoals
              ) {
                toast.success(
                  `⚽ GOAL! ${update.homeTeamName} ${update.homeGoals}-${update.awayGoals} ${update.awayTeamName}`,
                  { duration: 5000, position: 'top-right' },
                )
              }
              if (
                update.awayGoals !== null &&
                oldMatch.awayGoals !== null &&
                update.awayGoals > oldMatch.awayGoals
              ) {
                toast.success(
                  `⚽ GOAL! ${update.homeTeamName} ${update.homeGoals}-${update.awayGoals} ${update.awayTeamName}`,
                  { duration: 5000, position: 'top-right' },
                )
              }

              if (oldMatch.status !== 'FINISHED' && update.status === 'FINISHED') {
                toast(
                  `${update.homeTeamName} ${update.homeGoals}-${update.awayGoals} ${update.awayTeamName}\nMatch Finished`,
                  { icon: '🏁', duration: 5000, position: 'top-right' },
                )
              }
            }

            next[update.matchId] = update
          })

          if (generation === connectionGeneration) set({ liveMatches: next })
        } catch (err) {
          console.error('Error parsing SSE data', err)
        }
      }

      eventSource.onerror = () => {
        if (generation !== connectionGeneration) return
        set({ isConnected: false })
        // EventSource retries interrupted streams automatically.
      }
    })()
    connectPromise = connecting
    try {
      await connecting
    } finally {
      if (connectPromise === connecting) connectPromise = null
    }
  },

  disconnect: () => {
    connectionGeneration += 1;
    connectPromise = null;
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    set({ isConnected: false, isInitializing: true });
  }
}));
