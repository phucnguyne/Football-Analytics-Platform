'use client'

import React from 'react'
import type { TeamTactics } from '@/lib/tactics-generator'

interface PPDAMeterProps {
  homeTeam: TeamTactics
  awayTeam: TeamTactics
  summary?: {
    territorialDominance: string
    pressingBattle: string
    buildUpStyle: string
  }
}

export function PPDAMeter({ homeTeam, awayTeam, summary }: PPDAMeterProps) {
  const getPressingLabel = (ppda: number) => {
    if (ppda < 9.5) return { label: 'Aggressive High Press', color: 'text-rose-500 bg-rose-500/10 border-rose-500/30' }
    if (ppda < 13.5) return { label: 'Active Mid-Block', color: 'text-amber-500 bg-amber-500/10 border-amber-500/30' }
    return { label: 'Conservative Low-Block', color: 'text-blue-500 bg-blue-500/10 border-blue-500/30' }
  }

  const homeBadge = getPressingLabel(homeTeam.ppda)
  const awayBadge = getPressingLabel(awayTeam.ppda)

  // Max PPDA for gauge calculation (capped at 25)
  const maxPpda = 22
  const homeProgress = Math.min(100, Math.max(15, ((maxPpda - homeTeam.ppda) / maxPpda) * 100))
  const awayProgress = Math.min(100, Math.max(15, ((maxPpda - awayTeam.ppda) / maxPpda) * 100))

  return (
    <div className="space-y-6">
      {/* PPDA Explanation Banner */}
      <div className="bg-card p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <h4 className="font-bold text-sm">PPDA (Passes Allowed Per Defensive Action)</h4>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Measures pressing intensity outside the defending team's third. <strong className="text-foreground">Lower = more aggressive pressing</strong>.
          </p>
        </div>
        <div className="text-[10px] bg-muted px-2.5 py-1 rounded-md text-muted-foreground font-mono">
          Opta / Wyscout Metric
        </div>
      </div>

      {/* Head-to-Head Pressing Comparison Card */}
      <div className="bg-card p-6 rounded-2xl border space-y-6">
        <div className="grid md:grid-cols-2 gap-6 divide-y md:divide-y-0 md:divide-x divide-border">
          {/* Home PPDA */}
          <div className="space-y-3 pb-4 md:pb-0 md:pr-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                  Home Pressing
                </span>
                <h5 className="font-bold text-base text-foreground">{homeTeam.shortName}</h5>
              </div>
              <div className="text-right">
                <span className="text-3xl font-black tabular-nums text-foreground">{homeTeam.ppda}</span>
                <span className="text-[10px] text-muted-foreground block font-semibold">PPDA</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Pressing Intensity</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${homeBadge.color}`}>
                  {homeBadge.label}
                </span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  style={{ width: `${homeProgress}%` }}
                  className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full transition-all duration-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
              <div className="bg-muted/40 p-2.5 rounded-lg border border-transparent">
                <span className="text-[10px] text-muted-foreground block font-semibold">High Line</span>
                <span className="font-bold text-foreground">{homeTeam.defensiveLineHeight} Block</span>
              </div>
              <div className="bg-muted/40 p-2.5 rounded-lg border border-transparent">
                <span className="text-[10px] text-muted-foreground block font-semibold">Press Efficiency</span>
                <span className="font-bold text-foreground">{homeTeam.highPressEfficiency}%</span>
              </div>
            </div>
          </div>

          {/* Away PPDA */}
          <div className="space-y-3 pt-4 md:pt-0 md:pl-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                  Away Pressing
                </span>
                <h5 className="font-bold text-base text-foreground">{awayTeam.shortName}</h5>
              </div>
              <div className="text-right">
                <span className="text-3xl font-black tabular-nums text-foreground">{awayTeam.ppda}</span>
                <span className="text-[10px] text-muted-foreground block font-semibold">PPDA</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Pressing Intensity</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${awayBadge.color}`}>
                  {awayBadge.label}
                </span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  style={{ width: `${awayProgress}%` }}
                  className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full transition-all duration-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
              <div className="bg-muted/40 p-2.5 rounded-lg border border-transparent">
                <span className="text-[10px] text-muted-foreground block font-semibold">High Line</span>
                <span className="font-bold text-foreground">{awayTeam.defensiveLineHeight} Block</span>
              </div>
              <div className="bg-muted/40 p-2.5 rounded-lg border border-transparent">
                <span className="text-[10px] text-muted-foreground block font-semibold">Press Efficiency</span>
                <span className="font-bold text-foreground">{awayTeam.highPressEfficiency}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Field Tilt Territorial Control */}
        <div className="border-t pt-5 space-y-2">
          <div className="flex justify-between items-center text-xs font-bold">
            <span className="flex items-center gap-2">
              <span>🏟️</span>
              <span>Field Tilt (Final-Third Possession Dominance)</span>
            </span>
            <div className="flex gap-4">
              <span className="text-sky-400 font-mono">{homeTeam.fieldTilt}%</span>
              <span className="text-rose-400 font-mono">{awayTeam.fieldTilt}%</span>
            </div>
          </div>

          <div className="h-3 w-full bg-muted rounded-full overflow-hidden flex">
            <div
              style={{ width: `${homeTeam.fieldTilt}%` }}
              className="bg-sky-500 transition-all duration-500"
              title={`${homeTeam.shortName}: ${homeTeam.fieldTilt}%`}
            />
            <div
              style={{ width: `${awayTeam.fieldTilt}%` }}
              className="bg-rose-500 transition-all duration-500"
              title={`${awayTeam.shortName}: ${awayTeam.fieldTilt}%`}
            />
          </div>

          <div className="flex justify-between text-[11px] text-muted-foreground font-semibold">
            <span>{homeTeam.shortName}</span>
            <span>{awayTeam.shortName}</span>
          </div>
        </div>

        {/* High Turnover & Counter-Press Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t pt-5">
          <div className="bg-muted/20 p-3 rounded-xl text-center">
            <p className="text-xl font-bold text-primary">{homeTeam.turnoversWonHigh}</p>
            <p className="text-[10px] uppercase font-bold text-muted-foreground mt-0.5">
              {homeTeam.shortName} High Turnovers
            </p>
          </div>
          <div className="bg-muted/20 p-3 rounded-xl text-center">
            <p className="text-xl font-bold text-primary">{awayTeam.turnoversWonHigh}</p>
            <p className="text-[10px] uppercase font-bold text-muted-foreground mt-0.5">
              {awayTeam.shortName} High Turnovers
            </p>
          </div>
          <div className="bg-muted/20 p-3 rounded-xl text-center">
            <p className="text-xl font-bold text-foreground">{homeTeam.counterPressRecoveries}</p>
            <p className="text-[10px] uppercase font-bold text-muted-foreground mt-0.5">
              {homeTeam.shortName} Recoveries &lt;5s
            </p>
          </div>
          <div className="bg-muted/20 p-3 rounded-xl text-center">
            <p className="text-xl font-bold text-foreground">{awayTeam.counterPressRecoveries}</p>
            <p className="text-[10px] uppercase font-bold text-muted-foreground mt-0.5">
              {awayTeam.shortName} Recoveries &lt;5s
            </p>
          </div>
        </div>
      </div>

      {/* Qualitative Tactical Briefing */}
      {summary && (
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 rounded-xl border border-primary/20 space-y-1.5">
          <h5 className="font-bold text-xs uppercase tracking-wider text-primary flex items-center gap-1.5">
            <span>📋</span> Match Tactical Summary
          </h5>
          <p className="text-xs text-foreground/90 leading-relaxed">{summary.pressingBattle}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{summary.territorialDominance}</p>
        </div>
      )}
    </div>
  )
}

