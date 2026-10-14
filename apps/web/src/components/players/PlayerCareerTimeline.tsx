'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import type { CareerStats, CareerSeason, CareerMilestone, ClubHistoryEntry } from '@/lib/career-generator'

// ── Fetch helper ──────────────────────────────────────────────────────────────

async function fetchCareer(playerId: number): Promise<CareerStats> {
  const res = await fetch(`/api/persons/${playerId}/career`)
  if (!res.ok) throw new Error('Failed to fetch career stats')
  return res.json()
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function RatingBadge({ rating }: { rating: number }) {
  const color =
    rating >= 7.5 ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' :
    rating >= 6.8 ? 'text-amber-400 bg-amber-400/10 border-amber-400/20' :
                    'text-slate-400 bg-slate-400/10 border-slate-400/20'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-bold tabular-nums ${color}`}>
      {rating.toFixed(1)}
    </span>
  )
}

function TeamBadge({ team, size = 20 }: { team: { name: string; shortName: string; crest?: string }; size?: number }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      {team.crest ? (
        <Image src={team.crest} alt={team.shortName} width={size} height={size} className="object-contain shrink-0" />
      ) : (
        <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold shrink-0">
          {team.shortName.slice(0, 2).toUpperCase()}
        </div>
      )}
      <span className="truncate text-sm font-medium">{team.shortName}</span>
    </div>
  )
}

function StatCell({ value, label }: { value: string | number; label?: string }) {
  return (
    <td className="px-3 py-3 text-center tabular-nums">
      <span className="font-semibold text-sm">{value}</span>
      {label && <span className="text-muted-foreground text-xs ml-0.5">{label}</span>}
    </td>
  )
}

// ── Season Table ──────────────────────────────────────────────────────────────

function SeasonTable({ seasons }: { seasons: CareerSeason[] }) {
  const headers = [
    { key: 'year',        label: 'Season'  },
    { key: 'team',        label: 'Club'    },
    { key: 'competition', label: 'Comp.'   },
    { key: 'apps',        label: 'Apps'    },
    { key: 'mins',        label: 'Mins'    },
    { key: 'goals',       label: 'G'       },
    { key: 'assists',     label: 'A'       },
    { key: 'xG',          label: 'xG'      },
    { key: 'xA',          label: 'xA'      },
    { key: 'cards',       label: 'Y/R'     },
    { key: 'rating',      label: 'Rating'  },
  ]

  // Reverse so newest is on top
  const sorted = [...seasons].reverse()

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            {headers.map(h => (
              <th
                key={h.key}
                className="px-3 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider text-center whitespace-nowrap first:text-left"
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((s, i) => (
            <tr
              key={i}
              className={`border-b last:border-0 transition-colors ${
                s.isCurrent
                  ? 'bg-primary/5 hover:bg-primary/8'
                  : 'hover:bg-muted/30'
              }`}
            >
              {/* Season */}
              <td className="px-3 py-3 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm tabular-nums">{s.year}</span>
                  {s.isCurrent && (
                    <span className="px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded text-[9px] font-bold uppercase tracking-wide">
                      Current
                    </span>
                  )}
                </div>
              </td>

              {/* Club */}
              <td className="px-3 py-3 max-w-[130px]">
                <TeamBadge team={s.team} />
              </td>

              {/* Competition */}
              <td className="px-3 py-3 whitespace-nowrap">
                <span className="text-xs text-muted-foreground">{s.competition}</span>
              </td>

              <StatCell value={s.matchesPlayed} />
              <StatCell value={s.minutesPlayed.toLocaleString()} />

              {/* Goals — highlighted for forwards */}
              <td className="px-3 py-3 text-center">
                <span className={`font-bold text-sm tabular-nums ${s.goals >= 15 ? 'text-emerald-400' : ''}`}>
                  {s.goals}
                </span>
              </td>

              {/* Assists */}
              <td className="px-3 py-3 text-center">
                <span className={`font-bold text-sm tabular-nums ${s.assists >= 10 ? 'text-blue-400' : ''}`}>
                  {s.assists}
                </span>
              </td>

              <StatCell value={s.xG.toFixed(2)} />
              <StatCell value={s.xA.toFixed(2)} />

              {/* Cards */}
              <td className="px-3 py-3 text-center whitespace-nowrap">
                <span className="text-xs tabular-nums">
                  <span className="text-amber-400 font-bold">{s.yellowCards}</span>
                  <span className="text-muted-foreground mx-0.5">/</span>
                  <span className="text-red-400 font-bold">{s.redCards}</span>
                </span>
              </td>

              {/* Rating */}
              <td className="px-3 py-3 text-center">
                <RatingBadge rating={s.avgRating} />
              </td>
            </tr>
          ))}
        </tbody>

        {/* Totals footer */}
        <tfoot>
          <tr className="border-t-2 bg-muted/60 font-bold">
            <td className="px-3 py-3 text-xs uppercase tracking-wider text-muted-foreground" colSpan={3}>
              Career Total
            </td>
            <td className="px-3 py-3 text-center text-sm tabular-nums">
              {seasons.reduce((s, x) => s + x.matchesPlayed, 0)}
            </td>
            <td className="px-3 py-3 text-center text-sm tabular-nums">
              {seasons.reduce((s, x) => s + x.minutesPlayed, 0).toLocaleString()}
            </td>
            <td className="px-3 py-3 text-center text-sm tabular-nums text-emerald-400">
              {seasons.reduce((s, x) => s + x.goals, 0)}
            </td>
            <td className="px-3 py-3 text-center text-sm tabular-nums text-blue-400">
              {seasons.reduce((s, x) => s + x.assists, 0)}
            </td>
            <td className="px-3 py-3 text-center text-sm tabular-nums">
              {seasons.reduce((s, x) => s + x.xG, 0).toFixed(1)}
            </td>
            <td className="px-3 py-3 text-center text-sm tabular-nums">
              {seasons.reduce((s, x) => s + x.xA, 0).toFixed(1)}
            </td>
            <td className="px-3 py-3 text-center whitespace-nowrap text-sm">
              <span className="text-amber-400">{seasons.reduce((s, x) => s + x.yellowCards, 0)}</span>
              <span className="text-muted-foreground mx-0.5">/</span>
              <span className="text-red-400">{seasons.reduce((s, x) => s + x.redCards, 0)}</span>
            </td>
            <td className="px-3 py-3 text-center">
              <RatingBadge
                rating={+(seasons.reduce((s, x) => s + x.avgRating, 0) / seasons.length).toFixed(1)}
              />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ── Career Overview Stats ─────────────────────────────────────────────────────

function CareerOverview({ career }: { career: CareerStats }) {
  const cards = [
    { label: 'Appearances',   value: career.totalMatches,  color: 'text-primary'    },
    { label: 'Career Goals',  value: career.totalGoals,    color: 'text-emerald-400'},
    { label: 'Career Assists',value: career.totalAssists,  color: 'text-blue-400'   },
    { label: 'Seasons',       value: career.totalSeasons,  color: 'text-amber-400'  },
    {
      label: 'Minutes',
      value: `${(career.totalMinutes / 1000).toFixed(1)}k`,
      color: 'text-violet-400',
    },
    {
      label: 'Avg Rating',
      value: career.careerAvgRating.toFixed(1),
      color: career.careerAvgRating >= 7.2 ? 'text-emerald-400' : 'text-amber-400',
    },
  ]

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
      {cards.map(c => (
        <div key={c.label} className="bg-muted/30 rounded-xl border p-3 text-center">
          <div className={`text-2xl font-black tabular-nums ${c.color}`}>{c.value}</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{c.label}</div>
        </div>
      ))}
    </div>
  )
}

// ── Milestones Timeline ───────────────────────────────────────────────────────

const MILESTONE_COLORS: Record<string, string> = {
  goal:       'border-emerald-500 bg-emerald-500/10',
  assist:     'border-blue-500 bg-blue-500/10',
  appearance: 'border-amber-500 bg-amber-500/10',
  award:      'border-purple-500 bg-purple-500/10',
  debut:      'border-primary bg-primary/10',
  transfer:   'border-orange-500 bg-orange-500/10',
}

function MilestonesTimeline({ milestones }: { milestones: CareerMilestone[] }) {
  if (milestones.length === 0) {
    return <p className="text-muted-foreground text-sm italic">No major milestones yet.</p>
  }

  return (
    <div className="relative pl-6">
      {/* Vertical line */}
      <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />

      <div className="space-y-4">
        {milestones.map((m, i) => (
          <div key={i} className="relative flex gap-4 items-start">
            {/* Dot on the timeline */}
            <div className={`absolute -left-4 w-3 h-3 rounded-full border-2 mt-1.5 ${MILESTONE_COLORS[m.type] ?? 'border-border bg-muted'}`} />

            {/* Card */}
            <div className={`flex-1 p-3 rounded-xl border ${MILESTONE_COLORS[m.type] ?? 'border-border'}`}>
              <div className="flex items-start gap-3">
                <span className="text-xl leading-none shrink-0">{m.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm">{m.title}</span>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {m.season}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{m.description}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Club History ──────────────────────────────────────────────────────────────

function ClubHistoryList({ history }: { history: ClubHistoryEntry[] }) {
  return (
    <div className="space-y-3">
      {history.map((entry, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-3 bg-muted/20 rounded-xl border hover:border-border transition-colors"
        >
          {/* Club badge */}
          <div className="shrink-0">
            {entry.team.crest ? (
              <Image
                src={entry.team.crest}
                alt={entry.team.shortName}
                width={40}
                height={40}
                className="object-contain"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                {entry.team.shortName.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>

          {/* Club info */}
          <div className="flex-1 min-w-0">
            <Link href={`/teams/${entry.team.id}`} className="font-bold hover:text-primary transition-colors">
              {entry.team.name}
            </Link>
            <div className="text-xs text-muted-foreground mt-0.5">
              {entry.from} — {entry.to ? entry.to : <span className="text-emerald-400 font-semibold">Present</span>}
            </div>
          </div>

          {/* Stats row */}
          <div className="hidden sm:flex items-center gap-4 text-center text-sm shrink-0">
            {[
              { label: 'Apps',     value: entry.appearances },
              { label: 'Goals',    value: entry.goals,    cls: 'text-emerald-400' },
              { label: 'Assists',  value: entry.assists,  cls: 'text-blue-400'   },
            ].map(s => (
              <div key={s.label}>
                <div className={`font-bold tabular-nums ${s.cls ?? ''}`}>{s.value}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Peak Season Highlight ─────────────────────────────────────────────────────

function PeakSeasonBanner({ season }: { season: CareerSeason }) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-amber-500/10 via-primary/10 to-emerald-500/10 border border-amber-500/30 rounded-2xl p-5">
      <div className="absolute inset-0 opacity-5 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-amber-400 to-transparent pointer-events-none" />
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">🌟</span>
        <div>
          <div className="font-bold text-sm text-muted-foreground uppercase tracking-widest">Career Best Season</div>
          <div className="font-black text-xl">{season.year}</div>
        </div>
        <TeamBadge team={season.team} size={28} />
      </div>
      <div className="grid grid-cols-4 gap-3 text-center">
        {[
          { label: 'Goals',   value: season.goals,              cls: 'text-emerald-400' },
          { label: 'Assists', value: season.assists,            cls: 'text-blue-400'    },
          { label: 'Apps',    value: season.matchesPlayed,      cls: ''                 },
          { label: 'Rating',  value: season.avgRating.toFixed(1), cls: 'text-amber-400' },
        ].map(s => (
          <div key={s.label} className="bg-background/40 rounded-xl p-3 border border-white/5">
            <div className={`text-2xl font-black tabular-nums ${s.cls}`}>{s.value}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Tab switcher ──────────────────────────────────────────────────────────────

type Tab = 'seasons' | 'milestones' | 'clubs'

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'seasons',    label: 'Season Stats',  icon: '📊' },
  { key: 'milestones', label: 'Milestones',    icon: '🏅' },
  { key: 'clubs',      label: 'Club History',  icon: '🏟️' },
]

// ── Main Component ────────────────────────────────────────────────────────────

interface PlayerCareerTimelineProps {
  playerId: number
  playerName?: string
}

export function PlayerCareerTimeline({ playerId, playerName }: PlayerCareerTimelineProps) {
  const [activeTab, setActiveTab] = useState<Tab>('seasons')

  const { data: career, isLoading, isError } = useQuery({
    queryKey: ['career', playerId],
    queryFn:  () => fetchCareer(playerId),
    enabled:  !!playerId,
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <div className="bg-card border rounded-2xl p-6 animate-pulse">
        <div className="h-6 bg-muted rounded w-48 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (isError || !career) return null

  return (
    <div className="bg-card border rounded-2xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-6 bg-primary rounded-full" />
        <h3 className="text-xl font-bold">Career Statistics</h3>
        {playerName && (
          <span className="text-muted-foreground text-sm">— {playerName}</span>
        )}
      </div>

      {/* Career overview numbers */}
      <CareerOverview career={career} />

      {/* Peak season */}
      {career.peakSeason && <PeakSeasonBanner season={career.peakSeason} />}

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-muted/40 rounded-xl w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
              activeTab === t.key
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'seasons'    && <SeasonTable seasons={career.seasons} />}
      {activeTab === 'milestones' && <MilestonesTimeline milestones={career.milestones} />}
      {activeTab === 'clubs'      && <ClubHistoryList history={career.clubHistory} />}
    </div>
  )
}

