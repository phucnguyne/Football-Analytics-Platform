'use client'

import React, { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'
import { PageSpinner } from '@/components/ui/Spinner'
import { useTeams } from '@/hooks/useTeams'
import { PlayerPhoto } from '@/components/players/PlayerPhoto'

interface PlayerComparisonDashboardProps {
  initialPlayer1Id?: number
  initialPlayer2Id?: number
  initialPlayer1TeamId?: number
  initialPlayer2TeamId?: number
}

const METRIC_CONFIGS = [
  { key: 'matchesPlayed', label: 'Appearances', max: 38, category: 'Season' },
  { key: 'minutesPlayed', label: 'Minutes Played', max: 3420, category: 'Season' },
  { key: 'xG', label: 'Expected Goals (xG)', max: 1.0, category: 'Attacking' },
  { key: 'xA', label: 'Expected Assists (xA)', max: 0.6, category: 'Attacking' },
  { key: 'shotsPer90', label: 'Shots / 90', max: 5.0, category: 'Attacking' },
  { key: 'passCompletion', label: 'Pass Completion %', max: 100, category: 'Possession', unit: '%' },
  { key: 'progressivePasses', label: 'Prog. Passes / 90', max: 10, category: 'Possession' },
  { key: 'dribblesSuccess', label: 'Dribbles Success %', max: 100, category: 'Possession', unit: '%' },
  { key: 'tacklesPer90', label: 'Tackles / 90', max: 5.0, category: 'Defending' },
  { key: 'interceptions', label: 'Interceptions / 90', max: 4.0, category: 'Defending' },
  { key: 'savesPer90', label: 'Saves / 90', max: 5.0, category: 'Goalkeeping' },
  { key: 'savePercentage', label: 'Save %', max: 100, category: 'Goalkeeping', unit: '%' },
]

export function PlayerComparisonDashboard({
  initialPlayer1Id,
  initialPlayer2Id,
  initialPlayer1TeamId,
  initialPlayer2TeamId,
}: PlayerComparisonDashboardProps) {
  const [player1Id, setPlayer1Id] = useState<number | null>(initialPlayer1Id ?? null)
  const [player2Id, setPlayer2Id] = useState<number | null>(initialPlayer2Id ?? null)
  const [selectedTeam1Id, setSelectedTeam1Id] = useState(initialPlayer1TeamId ? String(initialPlayer1TeamId) : '')
  const [selectedTeam2Id, setSelectedTeam2Id] = useState(initialPlayer2TeamId ? String(initialPlayer2TeamId) : '')
  const [searchPlayer1, setSearchPlayer1] = useState('')
  const [searchPlayer2, setSearchPlayer2] = useState('')
  const [debouncedPlayer1, setDebouncedPlayer1] = useState('')
  const [debouncedPlayer2, setDebouncedPlayer2] = useState('')
  const { data: teams, isError: teamsError } = useTeams('PL')
  const activeTeam1Id = selectedTeam1Id || teams?.[0]?.id || ''
  const activeTeam2Id = selectedTeam2Id || teams?.[1]?.id || teams?.[0]?.id || ''

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedPlayer1(searchPlayer1.trim()), 250)
    return () => clearTimeout(timer)
  }, [searchPlayer1])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedPlayer2(searchPlayer2.trim()), 250)
    return () => clearTimeout(timer)
  }, [searchPlayer2])

  const { data: player1List, isError: player1SearchError } = useQuery<{
    players: { id: number; name: string; position: string; team?: { name: string; shortName: string } }[]
  }>({
    queryKey: ['players-list-search', activeTeam1Id, debouncedPlayer1],
    queryFn: async () => {
      const res = await fetch(
        `/api/persons?teamId=${encodeURIComponent(activeTeam1Id)}&query=${encodeURIComponent(debouncedPlayer1)}&limit=25`,
      )
      if (!res.ok) throw new Error('Failed to search players')
      return res.json()
    },
    staleTime: 60 * 1000,
    enabled: !!activeTeam1Id,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const { data: player2List, isError: player2SearchError } = useQuery<{
    players: { id: number; name: string; position: string; team?: { name: string; shortName: string } }[]
  }>({
    queryKey: ['players-list-search', activeTeam2Id, debouncedPlayer2],
    queryFn: async () => {
      const res = await fetch(
        `/api/persons?teamId=${encodeURIComponent(activeTeam2Id)}&query=${encodeURIComponent(debouncedPlayer2)}&limit=25`,
      )
      if (!res.ok) throw new Error('Failed to search players')
      return res.json()
    },
    staleTime: 60 * 1000,
    enabled: !!activeTeam2Id,
    retry: false,
    refetchOnWindowFocus: false,
  })

  // Query comparison data
  const { data: comparisonData, isLoading, isError, error: comparisonError } = useQuery({
    queryKey: ['player-comparison', player1Id, player2Id, activeTeam1Id, activeTeam2Id],
    queryFn: async () => {
      if (!player1Id || !player2Id) return null
      const params = new URLSearchParams({
        p1: String(player1Id),
        p2: String(player2Id),
        p1TeamId: String(activeTeam1Id),
        p2TeamId: String(activeTeam2Id),
      })
      const res = await fetch(`/api/persons/compare?${params}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to fetch comparison')
      }
      return res.json()
    },
    enabled: !!player1Id && !!player2Id && player1Id !== player2Id,
  })

  // Format radar data
  const radarData = METRIC_CONFIGS.map((m) => {
    const raw1 = comparisonData?.player1?.stats?.[m.key]
    const raw2 = comparisonData?.player2?.stats?.[m.key]
    const val1 = typeof raw1 === 'number' && Number.isFinite(raw1) ? raw1 : null
    const val2 = typeof raw2 === 'number' && Number.isFinite(raw2) ? raw2 : null

    return {
      subject: m.label.split(' ')[0],
      fullLabel: m.label,
      Player1: val1 === null ? null : Math.min(100, (val1 / m.max) * 100),
      Player2: val2 === null ? null : Math.min(100, (val2 / m.max) * 100),
      raw1: val1 === null ? null : Number(val1.toFixed(2)),
      raw2: val2 === null ? null : Number(val2.toFixed(2)),
    }
  })

  const p1 = comparisonData?.player1
  const p2 = comparisonData?.player2
  const verdict = comparisonData?.verdict
  const comparableMetrics = METRIC_CONFIGS.filter((metric) => {
    const value1 = p1?.stats?.[metric.key]
    const value2 = p2?.stats?.[metric.key]
    return typeof value1 === 'number' && Number.isFinite(value1) &&
      typeof value2 === 'number' && Number.isFinite(value2)
  })
  const comparableRadarData = radarData.filter((metric) =>
    typeof metric.Player1 === 'number' && typeof metric.Player2 === 'number',
  )

  return (
    <div className="bg-card p-6 rounded-2xl border space-y-8 shadow-sm">
      {/* Title & Player Selectors */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-6 bg-gradient-to-b from-sky-400 to-amber-400 rounded-full" />
            <h3 className="text-xl font-bold tracking-tight">Head-to-Head Player Comparison</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Compare tactical output, radar shapes & multidimensional skill distributions
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="min-w-0 space-y-2 rounded-xl border border-sky-500/20 p-3">
            <label className="flex flex-col gap-1 text-xs font-semibold text-sky-400">
              Player A club
              <select
                value={activeTeam1Id}
                onChange={(event) => {
                  setSelectedTeam1Id(event.target.value)
                  setPlayer1Id(null)
                }}
                className="h-9 w-full rounded-lg border bg-background px-3 text-xs text-foreground"
                aria-label="Select Player A club"
              >
                {teams?.map((team) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-sky-400">
              Search Player A
              <input
                type="search"
                placeholder="Search players..."
                value={searchPlayer1}
                onChange={(event) => setSearchPlayer1(event.target.value)}
                className="h-9 w-full rounded-lg border bg-background px-3 text-xs text-foreground"
                aria-label="Search Player A"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-sky-400">
              Select Player A
              <select
                value={player1Id ?? ''}
                onChange={(event) => setPlayer1Id(event.target.value ? Number(event.target.value) : null)}
                className="h-9 w-full rounded-lg border bg-background px-3 text-xs text-foreground"
                aria-label="Select Player A"
              >
                <option value="">Select Player A...</option>
                {player1Id && !player1List?.players.some((player) => player.id === player1Id) && (
                  <option value={player1Id}>Current selection (ID {player1Id})</option>
                )}
                {player1List?.players
                  ?.filter((player) => player.id !== player2Id)
                  .map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name} ({player.team?.shortName || player.position})
                    </option>
                  ))}
              </select>
            </label>
            {debouncedPlayer1 && player1List?.players.length === 0 && (
              <span className="font-normal text-muted-foreground" role="status">
                No matches in this roster. Try another club.
              </span>
            )}
          </section>

          <section className="min-w-0 space-y-2 rounded-xl border border-amber-500/20 p-3">
            <label className="flex flex-col gap-1 text-xs font-semibold text-amber-400">
              Player B club
              <select
                value={activeTeam2Id}
                onChange={(event) => {
                  setSelectedTeam2Id(event.target.value)
                  setPlayer2Id(null)
                }}
                className="h-9 w-full rounded-lg border bg-background px-3 text-xs text-foreground"
                aria-label="Select Player B club"
              >
                {teams?.map((team) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-amber-400">
              Search Player B
              <input
                type="search"
                placeholder="Search players..."
                value={searchPlayer2}
                onChange={(event) => setSearchPlayer2(event.target.value)}
                className="h-9 w-full rounded-lg border bg-background px-3 text-xs text-foreground"
                aria-label="Search Player B"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-amber-400">
              Select Player B
              <select
                value={player2Id ?? ''}
                onChange={(event) => setPlayer2Id(event.target.value ? Number(event.target.value) : null)}
                className="h-9 w-full rounded-lg border bg-background px-3 text-xs text-foreground"
                aria-label="Select Player B"
              >
                <option value="">Select Player B...</option>
                {player2Id && !player2List?.players.some((player) => player.id === player2Id) && (
                  <option value={player2Id}>Current selection (ID {player2Id})</option>
                )}
                {player2List?.players
                  ?.filter((player) => player.id !== player1Id)
                  .map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name} ({player.team?.shortName || player.position})
                    </option>
                  ))}
              </select>
            </label>
            {debouncedPlayer2 && player2List?.players.length === 0 && (
              <span className="font-normal text-muted-foreground" role="status">
                No matches in this roster. Try another club.
              </span>
            )}
          </section>
        </div>
      </div>

      {(teamsError || player1SearchError || player2SearchError) && (
        <p className="text-sm text-destructive">
          Could not load clubs or players. Please try again later.
        </p>
      )}

      {!player1Id || !player2Id || player1Id === player2Id ? (
        <div className="bg-muted/20 border-2 border-dashed border-border rounded-xl p-10 text-center space-y-2">
          <p className="text-3xl">⚖️</p>
          <h4 className="font-bold text-base">
            {player1Id === player2Id && player1Id
              ? 'Choose two different players'
              : 'Select two players to compare'}
          </h4>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Search within a club roster, then select Player A and Player B to compare their profiles.
          </p>
        </div>
      ) : isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center space-y-3">
          <PageSpinner />
          <p className="text-xs text-muted-foreground font-medium">Computing comparative metrics...</p>
        </div>
      ) : isError || !p1 || !p2 ? (
        <div className="p-6 text-center text-destructive text-sm">
          {comparisonError instanceof Error
            ? comparisonError.message
            : 'Could not load comparison data. Check player IDs and try again.'}
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in">
          {/* Head-to-Head Banner Cards */}
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Player 1 Card */}
            <div className="bg-sky-500/10 border border-sky-500/30 p-5 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <PlayerPhoto
                  playerId={p1.id}
                  name={p1.name}
                  photo={p1.photo}
                  fallback={p1.shirtNumber ? `#${p1.shirtNumber}` : 'A'}
                  className="h-12 w-12 rounded-full border border-sky-500/40"
                />
                <div>
                  <h4 className="font-bold text-base text-foreground">{p1.name}</h4>
                  <p className="text-xs text-muted-foreground">
                    {p1.team?.name || 'Club'} • {p1.position?.replace('_', ' ')}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-sky-400 tracking-wider block">
                  Player A
                </span>
                <span className="text-sm font-bold text-foreground">
                  {p1.stats?.goals ?? '—'}G, {p1.stats?.assists ?? '—'}A
                </span>
              </div>
            </div>

            {/* Player 2 Card */}
            <div className="bg-amber-500/10 border border-amber-500/30 p-5 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <PlayerPhoto
                  playerId={p2.id}
                  name={p2.name}
                  photo={p2.photo}
                  fallback={p2.shirtNumber ? `#${p2.shirtNumber}` : 'B'}
                  className="h-12 w-12 rounded-full border border-amber-500/40"
                />
                <div>
                  <h4 className="font-bold text-base text-foreground">{p2.name}</h4>
                  <p className="text-xs text-muted-foreground">
                    {p2.team?.name || 'Club'} • {p2.position?.replace('_', ' ')}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider block">
                  Player B
                </span>
                <span className="text-sm font-bold text-foreground">
                  {p2.stats?.goals ?? '—'}G, {p2.stats?.assists ?? '—'}A
                </span>
              </div>
            </div>
          </div>

          {/* Overlaid Dual Radar Chart */}
          <div className="bg-card p-6 rounded-2xl border flex flex-col min-h-[420px]">
            <h4 className="font-bold text-base flex items-center gap-2 mb-2">
              <span>🎯</span> Player Comparison Spider Chart
            </h4>
            {comparisonData?.metricsAvailable ? (
              <p className="mb-2 text-xs text-muted-foreground" role="status">
                Data source: {comparisonData.statsSource}
                {comparisonData.statsSeason ? ` · ${comparisonData.statsSeason} season` : ''}.
                {p1.stats?.competition && p2.stats?.competition
                  ? ` Player A: ${p1.stats.competition}; Player B: ${p2.stats.competition}.`
                  : ''}
                {' '}Only actual metrics available for both players are shown.
              </p>
            ) : (
              <p className="mb-2 text-xs text-muted-foreground" role="status">
                No shared performance metrics are available for this player pair from the configured data sources. Values are not estimated or fabricated.
              </p>
            )}

            <div className="h-[360px] w-full relative -ml-4">
              {comparableRadarData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={comparableRadarData}>
                  <PolarGrid stroke="currentColor" className="text-border" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: 'currentColor', fontSize: 11 }}
                    className="text-muted-foreground font-semibold"
                  />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />

                  <Radar
                    name={p1.name}
                    dataKey="Player1"
                    stroke="#38bdf8"
                    fill="#38bdf8"
                    fillOpacity={0.4}
                    strokeWidth={2}
                  />

                  <Radar
                    name={p2.name}
                    dataKey="Player2"
                    stroke="#f59e0b"
                    fill="#f59e0b"
                    fillOpacity={0.4}
                    strokeWidth={2}
                  />

                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length >= 2) {
                        const d = payload[0].payload
                        return (
                          <div className="bg-popover text-popover-foreground border shadow-xl p-3 rounded-xl text-xs space-y-1">
                            <p className="font-bold text-sm mb-1">{d.fullLabel}</p>
                            <p className="text-sky-400 font-semibold">
                              {p1.name}: {d.raw1}
                            </p>
                            <p className="text-amber-400 font-semibold">
                              {p2.name}: {d.raw2}
                            </p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  A spider chart needs at least one real shared metric.
                </div>
              )}
            </div>
          </div>

          {/* Detailed Metric Comparison Bars */}
          {comparisonData?.metricsAvailable && comparableMetrics.length > 0 && (
            <div className="bg-card p-6 rounded-2xl border space-y-5">
              <h4 className="font-bold text-base flex items-center gap-2 border-b pb-3">
                <span>📊</span> Statistical Head-to-Head Advantage
              </h4>

              <div className="space-y-4">
                {comparableMetrics.map((metric) => {
                  const val1 = p1.stats[metric.key]
                  const val2 = p2.stats[metric.key]
                  const total = Math.max(0.001, val1 + val2)
                  const pct1 = Math.round((val1 / total) * 100)
                  const pct2 = 100 - pct1
                  const isP1Leading = val1 > val2
                  const isP2Leading = val2 > val1

                  return (
                    <div key={metric.key} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span
                          className={`font-bold tabular-nums ${
                            isP1Leading ? 'text-sky-400 font-black' : 'text-muted-foreground'
                          }`}
                        >
                          {val1.toFixed(2)}
                          {metric.unit || ''}
                        </span>

                        <span className="font-semibold text-foreground text-center">
                          {metric.label}
                        </span>

                        <span
                          className={`font-bold tabular-nums ${
                            isP2Leading ? 'text-amber-400 font-black' : 'text-muted-foreground'
                          }`}
                        >
                          {val2.toFixed(2)}
                          {metric.unit || ''}
                        </span>
                      </div>

                      <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden flex">
                        <div
                          style={{ width: `${pct1}%` }}
                          className={`h-full transition-all duration-300 ${
                            isP1Leading ? 'bg-sky-400' : 'bg-sky-400/40'
                          }`}
                        />
                        <div
                          style={{ width: `${pct2}%` }}
                          className={`h-full transition-all duration-300 ${
                            isP2Leading ? 'bg-amber-400' : 'bg-amber-400/40'
                          }`}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Automated Scouting Verdict */}
          {verdict && (
            <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5 rounded-2xl border border-primary/20 space-y-2">
              <h5 className="font-bold text-xs uppercase tracking-wider text-primary flex items-center gap-2">
                <span>📋</span> {verdict.headline}
              </h5>
              <ul className="space-y-1.5 text-xs text-foreground/90">
                {verdict.bullets.map((b: string, i: number) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary font-bold">•</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
