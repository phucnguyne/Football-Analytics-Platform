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
let reconnectTimer: NodeJS.Timeout;

export const useLiveStore = create<LiveStoreState>((set, get) => ({
  liveMatches: {},
  isConnected: false,
  isInitializing: true,

  connect: async () => {
    if (eventSource) return;

    if (get().isInitializing) {
      try {
        const res = await fetch('/api/matches?status=LIVE,IN_PLAY,PAUSED');
        if (res.ok) {
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
          set({ liveMatches: initialMap });
        }
      } catch (err) {
        console.error('Failed to fetch initial matches', err);
      } finally {
        set({ isInitializing: false });
      }
    }

    eventSource = new EventSource('/api/live/stream')

    eventSource.onopen = () => {
      set({ isConnected: true })
    }

    eventSource.onmessage = (event) => {
      try {
        const updates: LiveMatchUpdate[] = JSON.parse(event.data)
        const prev = get().liveMatches;
        const next = { ...prev };
        
        updates.forEach(u => {
          const oldMatch = prev[u.matchId];
          
          if (oldMatch) {
             // Goal notification
             if (u.homeGoals !== null && oldMatch.homeGoals !== null && u.homeGoals > oldMatch.homeGoals) {
               toast.success(`⚽ GOAL! ${u.homeTeamName} ${u.homeGoals}-${u.awayGoals} ${u.awayTeamName}`, { duration: 5000, position: 'top-right' });
             }
             if (u.awayGoals !== null && oldMatch.awayGoals !== null && u.awayGoals > oldMatch.awayGoals) {
               toast.success(`⚽ GOAL! ${u.homeTeamName} ${u.homeGoals}-${u.awayGoals} ${u.awayTeamName}`, { duration: 5000, position: 'top-right' });
             }

             // Status notification
             if (oldMatch.status !== 'FINISHED' && u.status === 'FINISHED') {
               toast(`${u.homeTeamName} ${u.homeGoals}-${u.awayGoals} ${u.awayTeamName}\nMatch Finished`, { icon: '🏁', duration: 5000, position: 'top-right' });
             }
          }
          
          next[u.matchId] = u;
        });

        set({ liveMatches: next });
      } catch (err) {
        console.error('Error parsing SSE data', err)
      }
    }

    eventSource.onerror = (err) => {
      console.error('SSE Error', err)
      set({ isConnected: false })
      eventSource?.close()
      eventSource = null;
      reconnectTimer = setTimeout(() => get().connect(), 5000)
    }
  },

  disconnect: () => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    clearTimeout(reconnectTimer);
    set({ isConnected: false });
  }
}));
