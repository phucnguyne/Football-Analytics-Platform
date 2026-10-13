'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { PageSpinner } from '@/components/ui/Spinner'
import type { FormMatch, FormSummary } from '@/lib/player-analytics'

interface PlayerFormTrendProps {
  playerId: number
  playerName: string
}

export function PlayerFormTrend({ playerId, playerName }: PlayerFormTrendProps) {
  const [metric, setMetric] = useState<'rating' | 'xg_xa' | 'goals_assists'>('rating')

  const { data, isLoading, isError } = useQuery<{
    matches: FormMatch[]
    summary: FormSummary
  }>({
    queryKey: ['player-form', playerId],
    queryFn: async () => {
      const res = await fetch(`/api/persons/${playerId}/form`)
      if (!res.ok) throw new Error('Failed to fetch player form')
      return res.json()
    },
    staleTime: 60 * 1000,
  })

  if (isLoading) {
    return (
      <div className="bg-card p-8 rounded-2xl border flex flex-col items-center justify-center">
        <PageSpinner />
        <p className="text-xs text-muted-foreground mt-2">Loading form trajectory...</p>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="bg-card p-6 rounded-2xl border text-center text-muted-foreground text-sm">
        Form trend data unavailable.
      </div>
    )
  }

  const { matches, summary } = data

  const chartData = matches.map((m, idx) => ({
    matchLabel: `GW${idx + 1}`,
    opponent: m.opponent.shortName,
    crest: m.opponent.crest,
    result: m.result,
    score: m.score,
    rating: m.rating,
    xG: m.xG,
    xA: m.xA,
    goals: m.goals,
    assists: m.assists,
    minutes: m.minutes,
  }))

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload
      return (
        <div className="bg-popover border text-popover-foreground shadow-2xl p-3.5 rounded-xl text-xs space-y-1.5 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3 border-b pb-1.5 font-bold">
            <span className="flex items-center gap-1.5">
              <span>vs</span>
              <span>{d.opponent}</span>
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                d.result === 'W'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : d.result === 'D'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-rose-500/20 text-rose-400'
              }`}
            >
              {d.result} ({d.score})
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 text-[11px]">
            <span className="text-muted-foreground">Match Rating:</span>
            <span className="font-bold text-primary">{d.rating} / 10</span>
            <span className="text-muted-foreground">Minutes Played:</span>
            <span className="font-semibold">{d.minutes}'</span>
            <span className="text-muted-foreground">xG / xA:</span>
            <span className="font-semibold text-foreground">
              {d.xG} / {d.xA}
            </span>
            <span className="text-muted-foreground">Goals / Assists:</span>
            <span className="font-semibold text-emerald-400">
              {d.goals}G, {d.assists}A
            </span>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-card p-6 rounded-2xl border space-y-5 shadow-sm">
      {/* Header with Title and Form Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-6 bg-primary rounded-full" />
            <h3 className="text-lg font-bold">Form Over Time (Form Trend)</h3>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              Last {matches.length} Matches
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Match-by-match performance ratings and output trajectory
          </p>
        </div>

        {/* Metric Switcher */}
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border">
          <button
            onClick={() => setMetric('rating')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              metric === 'rating'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            ⭐ Rating
          </button>
          <button
            onClick={() => setMetric('xg_xa')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              metric === 'xg_xa'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            🎯 xG & xA
          </button>
          <button
            onClick={() => setMetric('goals_assists')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              metric === 'goals_assists'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            ⚽ G + A
          </button>
        </div>
      </div>

      {/* Form Summary Banner */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="text-2xl">📈</div>
          <div>
            <span className="text-xs font-bold text-foreground block">{summary.formBadge}</span>
            <span className="text-[11px] text-muted-foreground">
              Last 5 matches avg rating: <strong className="text-primary">{summary.last5Rating}</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="text-right">
            <span className="text-[10px] text-muted-foreground block uppercase font-bold">Goals (L5)</span>
            <span className="font-bold text-emerald-400">{summary.totalGoalsLast5}</span>
          </div>
          <div className="text-right border-l pl-4">
            <span className="text-[10px] text-muted-foreground block uppercase font-bold">Assists (L5)</span>
            <span className="font-bold text-sky-400">{summary.totalAssistsLast5}</span>
          </div>
          <div className="text-right border-l pl-4">
            <span className="text-[10px] text-muted-foreground block uppercase font-bold">Trend</span>
            <span
              className={`font-bold ${
                summary.trend === 'UP'
                  ? 'text-emerald-400'
                  : summary.trend === 'DOWN'
                  ? 'text-rose-400'
                  : 'text-muted-foreground'
              }`}
            >
              {summary.trend === 'UP' ? '▲ Rising' : summary.trend === 'DOWN' ? '▼ Cooling' : '▶ Stable'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Form Trend Chart */}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="ratingGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="xgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="xaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#a855f7" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#a855f7" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/40" />

            <XAxis
              dataKey="matchLabel"
              tick={{ fill: 'currentColor', fontSize: 11 }}
              className="text-muted-foreground font-medium"
            />

            <YAxis
              domain={metric === 'rating' ? [5, 10] : [0, 'auto']}
              tick={{ fill: 'currentColor', fontSize: 11 }}
              className="text-muted-foreground font-medium"
            />

            <Tooltip content={<CustomTooltip />} />

            {metric === 'rating' && (
              <Area
                type="monotone"
                dataKey="rating"
                name="Rating"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                fill="url(#ratingGradient)"
                dot={{ stroke: 'hsl(var(--primary))', strokeWidth: 2, r: 4, fill: '#0f172a' }}
                activeDot={{ r: 6, stroke: '#ffffff', strokeWidth: 2 }}
              />
            )}

            {metric === 'xg_xa' && (
              <>
                <Area
                  type="monotone"
                  dataKey="xG"
                  name="Expected Goals"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  fill="url(#xgGradient)"
                  dot={{ r: 3, fill: '#38bdf8' }}
                />
                <Area
                  type="monotone"
                  dataKey="xA"
                  name="Expected Assists"
                  stroke="#a855f7"
                  strokeWidth={2}
                  fill="url(#xaGradient)"
                  dot={{ r: 3, fill: '#a855f7' }}
                />
              </>
            )}

            {metric === 'goals_assists' && (
              <>
                <Area
                  type="monotone"
                  dataKey="goals"
                  name="Goals"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="#10b981"
                  fillOpacity={0.15}
                  dot={{ r: 4, fill: '#10b981' }}
                />
                <Area
                  type="monotone"
                  dataKey="assists"
                  name="Assists"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  fill="#38bdf8"
                  fillOpacity={0.1}
                  dot={{ r: 3, fill: '#38bdf8' }}
                />
              </>
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Match-by-Match Strip */}
      <div className="border-t pt-4">
        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block mb-2">
          Recent Match Form Sequence
        </span>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {matches.map((m, idx) => (
            <div
              key={idx}
              className="bg-muted/40 hover:bg-muted/80 p-2 rounded-xl text-center border transition-all cursor-default"
              title={`${m.isHome ? 'vs' : '@'} ${m.opponent.name} (${m.score}) - Rating: ${m.rating}`}
            >
              <div className="text-[10px] text-muted-foreground font-semibold truncate mb-1">
                {m.opponent.shortName}
              </div>
              <div
                className={`w-6 h-6 rounded-full mx-auto flex items-center justify-center font-black text-[10px] ${
                  m.result === 'W'
                    ? 'bg-emerald-500 text-white'
                    : m.result === 'D'
                    ? 'bg-amber-500 text-white'
                    : 'bg-rose-500 text-white'
                }`}
              >
                {m.result}
              </div>
              <div className="text-[11px] font-bold text-foreground mt-1 tabular-nums">{m.rating}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

