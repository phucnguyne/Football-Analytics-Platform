'use client'

import React, { useState } from 'react'
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

interface PlayerComparisonDashboardProps {
  initialPlayer1Id: number
  initialPlayer2Id?: number
}

const METRIC_CONFIGS = [
  { key: 'xG', label: 'Expected Goals (xG)', max: 1.0, category: 'Attacking' },
  { key: 'xA', label: 'Expected Assists (xA)', max: 0.6, category: 'Attacking' },
  { key: 'shotsPer90', label: 'Shots / 90', max: 5.0, category: 'Attacking' },
  { key: 'passCompletion', label: 'Pass Completion %', max: 100, category: 'Possession', unit: '%' },
  { key: 'progressivePasses', label: 'Prog. Passes / 90', max: 10, category: 'Possession' },
  { key: 'dribblesSuccess', label: 'Dribbles Success %', max: 100, category: 'Possession', unit: '%' },
  { key: 'tacklesPer90', label: 'Tackles / 90', max: 5.0, category: 'Defending' },
  { key: 'interceptions', label: 'Interceptions / 90', max: 4.0, category: 'Defending' },
]

export function PlayerComparisonDashboard({
  initialPlayer1Id,
  initialPlayer2Id,
}: PlayerComparisonDashboardProps) {
  const [player1Id, setPlayer1Id] = useState<number>(initialPlayer1Id)
  const [player2Id, setPlayer2Id] = useState<number | null>(initialPlayer2Id ?? null)

  // Search query for candidate player
  const [searchQuery, setSearchQuery] = useState('')

  // Query players list for picker
  const { data: playersList } = useQuery<{
    players: { id: number; name: string; position: string; team?: { name: string; shortName: string } }[]
  }>({
    queryKey: ['players-list-search', searchQuery],
    queryFn: async () => {
      const res = await fetch(`/api/persons?query=${encodeURIComponent(searchQuery)}&limit=15`)
      if (!res.ok) throw new Error('Failed to search players')
      return res.json()
    },
    staleTime: 60 * 1000,
  })

  // Query comparison data
  const { data: comparisonData, isLoading, isError } = useQuery({
    queryKey: ['player-comparison', player1Id, player2Id],
    queryFn: async () => {
      if (!player2Id) return null
      const res = await fetch(`/api/persons/compare?p1=${player1Id}&p2=${player2Id}`)
      if (!res.ok) throw new Error('Failed to fetch comparison')
      return res.json()
    },
    enabled: !!player2Id && player1Id !== player2Id,
  })

  // Format radar data
  const radarData = METRIC_CONFIGS.map((m) => {
    const val1 = comparisonData?.player1?.stats?.[m.key] ?? 0
    const val2 = comparisonData?.player2?.stats?.[m.key] ?? 0

    return {
      subject: m.label.split(' ')[0],
      fullLabel: m.label,
      Player1: Math.min(100, (val1 / m.max) * 100),
      Player2: Math.min(100, (val2 / m.max) * 100),
      raw1: Number(val1.toFixed(2)),
      raw2: Number(val2.toFixed(2)),
    }
  })

  const p1 = comparisonData?.player1
  const p2 = comparisonData?.player2
  const verdict = comparisonData?.verdict

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

        {/* Player 2 Picker Search / Dropdown */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search opponent player..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 px-3 text-xs rounded-lg border bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-48"
          />

          <select
            value={player2Id ?? ''}
            onChange={(e) => setPlayer2Id(e.target.value ? Number(e.target.value) : null)}
            className="h-9 px-3 text-xs font-semibold rounded-lg border bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring max-w-[220px]"
          >
            <option value="">Select player to compare...</option>
            {playersList?.players
              ?.filter((p) => p.id !== player1Id)
              ?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.team?.shortName || p.position})
                </option>
              ))}
          </select>
        </div>
      </div>

      {!player2Id ? (
        <div className="bg-muted/20 border-2 border-dashed border-border rounded-xl p-10 text-center space-y-2">
          <p className="text-3xl">⚖️</p>
          <h4 className="font-bold text-base">Select a Player to Compare</h4>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Choose any player from the dropdown above or pick one from the Similar Players list below to view dual-radar overlays and head-to-head metrics.
          </p>
        </div>
      ) : isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center space-y-3">
          <PageSpinner />
          <p className="text-xs text-muted-foreground font-medium">Computing comparative metrics...</p>
        </div>
      ) : isError || !p1 || !p2 ? (
        <div className="p-6 text-center text-muted-foreground text-sm">
          Failed to load comparison data.
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in">
          {/* Head-to-Head Banner Cards */}
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Player 1 Card */}
            <div className="bg-sky-500/10 border border-sky-500/30 p-5 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center text-xl font-bold border border-sky-500/40">
                  {p1.shirtNumber ? `#${p1.shirtNumber}` : '1'}
                </div>
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
                <span className="text-sm font-bold text-foreground">{p1.stats?.goals || 0}G, {p1.stats?.assists || 0}A</span>
              </div>
            </div>

            {/* Player 2 Card */}
            <div className="bg-amber-500/10 border border-amber-500/30 p-5 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xl font-bold border border-amber-500/40">
                  {p2.shirtNumber ? `#${p2.shirtNumber}` : '2'}
                </div>
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
                <span className="text-sm font-bold text-foreground">{p2.stats?.goals || 0}G, {p2.stats?.assists || 0}A</span>
              </div>
            </div>
          </div>

          {/* Overlaid Dual Radar Chart */}
          <div className="bg-card p-6 rounded-2xl border flex flex-col h-[420px]">
            <h4 className="font-bold text-base flex items-center gap-2 mb-2">
              <span>🎯</span> Dual-Radar Profile Overlay
            </h4>

            <div className="flex-1 w-full relative -ml-4">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
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
            </div>
          </div>

          {/* Detailed Metric Comparison Bars */}
          <div className="bg-card p-6 rounded-2xl border space-y-5">
            <h4 className="font-bold text-base flex items-center gap-2 border-b pb-3">
              <span>📊</span> Statistical Head-to-Head Advantage
            </h4>

            <div className="space-y-4">
              {METRIC_CONFIGS.map((metric) => {
                const val1 = p1.stats?.[metric.key] ?? 0
                const val2 = p2.stats?.[metric.key] ?? 0
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

