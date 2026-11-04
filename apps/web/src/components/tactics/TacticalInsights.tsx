'use client'

import { useQuery } from '@tanstack/react-query'
import { PageSpinner } from '@/components/ui/Spinner'

interface TacticalDataAvailability {
  available: boolean
  reason?: string
  source?: string
  eventCount?: number
  passCount?: number
  passingNetwork?: { nodes: { name: string; touches: number }[]; links: { count: number }[] }
  teams: {
    id: number
    name: string
    lineup: {
      id: number
      name: string
      shirtNumber: number | null
      isStarter: boolean
    }[]
  }[]
}

interface TacticalInsightsProps {
  matchId: string | number
}

export function TacticalInsights({ matchId }: TacticalInsightsProps) {
  const { data, isLoading, isError } = useQuery<TacticalDataAvailability>({
    queryKey: ['tactics', matchId],
    queryFn: async () => {
      const res = await fetch(`/api/matches/${matchId}/tactics`)
      if (!res.ok) throw new Error('Failed to fetch tactical data')
      return res.json()
    },
    staleTime: 60 * 1000,
  })

  if (isLoading) {
    return (
      <div className="rounded-2xl border bg-card p-10 text-center">
        <PageSpinner />
        <p className="mt-3 text-sm text-muted-foreground">Checking available match data...</p>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="rounded-2xl border bg-card p-6 text-center text-muted-foreground">
        Tactical data could not be loaded for this match.
      </div>
    )
  }

  const hasLineups = data.teams.some((team) => team.lineup.length > 0)

  return (
    <section className="space-y-5 rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="h-6 w-2.5 rounded-full bg-primary" />
        <h3 className="text-xl font-bold tracking-tight">Tactical Insights</h3>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${data.available ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' : 'border-amber-500/30 bg-amber-500/10 text-amber-500'}`}>
          {data.available ? 'StatsBomb open data' : 'Data unavailable'}
        </span>
      </div>

      {data.available ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-muted/30 p-4"><p className="text-xs text-muted-foreground">Events</p><p className="text-2xl font-bold">{data.eventCount ?? 0}</p></div>
          <div className="rounded-xl border bg-muted/30 p-4"><p className="text-xs text-muted-foreground">Passes</p><p className="text-2xl font-bold">{data.passCount ?? 0}</p></div>
          <div className="rounded-xl border bg-muted/30 p-4"><p className="text-xs text-muted-foreground">Players with touches</p><p className="text-2xl font-bold">{data.passingNetwork?.nodes.length ?? 0}</p></div>
        </div>
      ) : (
        <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
          <p className="text-sm font-medium">Passing networks, player heatmaps, PPDA, and build-up metrics are not shown.</p>
          <p className="mt-2 text-sm text-muted-foreground">{data.reason ?? 'No matching StatsBomb event file was found for this match.'}</p>
        </div>
      )}

      <div>
        <h4 className="mb-3 text-sm font-semibold">Confirmed player names</h4>
        {!hasLineups ? (
          <p className="text-sm text-muted-foreground">
            No match lineups are stored for this game, so player names cannot be verified. We do
            not substitute position labels or guessed names.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {data.teams.map((team) => (
              <div key={team.id} className="rounded-xl border p-4">
                <h5 className="mb-3 font-semibold">{team.name}</h5>
                <ul className="space-y-2">
                  {team.lineup.map((player) => (
                    <li key={player.id} className="flex items-center gap-2 text-sm">
                      <span className="w-7 text-right text-xs font-semibold text-muted-foreground">
                        {player.shirtNumber ?? '—'}
                      </span>
                      <span>{player.name}</span>
                      {!player.isStarter && (
                        <span className="text-xs text-muted-foreground">Substitute</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
