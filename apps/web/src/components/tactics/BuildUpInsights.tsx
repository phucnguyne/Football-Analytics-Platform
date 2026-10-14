'use client'

import React from 'react'
import type { TeamTactics } from '@/lib/tactics-generator'

// ── Shared small helpers ──────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
      {children}
    </h4>
  )
}

function StatRow({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: string
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-bold tabular-nums ${accent ?? ''}`}>
        {value}
        {sub && <span className="text-xs text-muted-foreground font-normal ml-1">{sub}</span>}
      </span>
    </div>
  )
}

// ── Possession half-arc gauge ─────────────────────────────────────────────────

function PossessionGauge({ home, away }: { home: number; away: number }) {
  const homePct = Math.min(100, Math.max(0, home))
  const awayPct = 100 - homePct

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Home</span>
        <span>Possession</span>
        <span>Away</span>
      </div>
      <div className="flex h-8 rounded-full overflow-hidden gap-0.5 border border-border/40">
        <div
          className="bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm transition-all"
          style={{ width: `${homePct}%` }}
        >
          {homePct}%
        </div>
        <div
          className="bg-orange-500 flex items-center justify-center text-white font-bold text-sm transition-all"
          style={{ width: `${awayPct}%` }}
        >
          {awayPct}%
        </div>
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary inline-block" /> Home possession</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block" /> Away possession</span>
      </div>
    </div>
  )
}

// ── Build-up style badge ──────────────────────────────────────────────────────

const STYLE_META: Record<string, { color: string; desc: string; icon: string }> = {
  'Short-Passing': {
    color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
    icon: '🔄',
    desc: 'Patient build-up through short combinations; goalkeeper & centre-backs start sequences.',
  },
  'Direct': {
    color: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
    icon: '⚡',
    desc: 'Quick vertical progression, bypassing midfield lines to reach attackers early.',
  },
  'Mixed': {
    color: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
    icon: '🎯',
    desc: 'Adaptive style — patient in own half, direct when transitioning past midfield.',
  },
  'Long-Ball': {
    color: 'text-red-400 bg-red-400/10 border-red-400/30',
    icon: '🏹',
    desc: 'Prioritises long aerial balls to the forward line; wins second balls in final third.',
  },
}

function BuildUpStyleBadge({ style }: { style: string }) {
  const meta = STYLE_META[style] ?? STYLE_META['Mixed']
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border ${meta.color}`}>
      <span className="text-2xl">{meta.icon}</span>
      <div>
        <div className="font-bold text-sm">{style}</div>
        <p className="text-xs opacity-80 mt-0.5 leading-snug">{meta.desc}</p>
      </div>
    </div>
  )
}

// ── Final-third entry stacked bar ─────────────────────────────────────────────

function FinalThirdBar({
  carry,
  pass,
  setPiece,
}: {
  carry: number
  pass: number
  setPiece: number
}) {
  const segments = [
    { label: 'Carry',     pct: carry,    color: 'bg-primary',    textColor: 'text-primary'    },
    { label: 'Pass',      pct: pass,     color: 'bg-emerald-500',textColor: 'text-emerald-400' },
    { label: 'Set Piece', pct: setPiece, color: 'bg-amber-500',  textColor: 'text-amber-400'  },
  ]

  return (
    <div className="space-y-3">
      <div className="flex h-7 rounded-full overflow-hidden gap-0.5">
        {segments.map(s => (
          <div
            key={s.label}
            className={`${s.color} flex items-center justify-center text-white text-[10px] font-bold transition-all`}
            style={{ width: `${s.pct}%` }}
            title={`${s.label}: ${s.pct}%`}
          >
            {s.pct >= 12 ? `${s.pct}%` : ''}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {segments.map(s => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs">
            <span className={`w-2.5 h-2.5 rounded-sm ${s.color}`} />
            <span className="text-muted-foreground">{s.label}</span>
            <span className={`font-bold ${s.textColor}`}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Pressing trigger pitch map (simplified SVG) ───────────────────────────────

function PressTriggerMap({
  ownHalf,
  middleThird,
  highPress,
  teamName,
}: {
  ownHalf: number
  middleThird: number
  highPress: number
  teamName: string
}) {
  const zones = [
    { label: 'Own Half',     pct: ownHalf,     color: 'rgba(148,163,184,0.4)', textCol: '#94a3b8' },
    { label: 'Middle Third', pct: middleThird,  color: 'rgba(251,191,36,0.45)', textCol: '#fbbf24' },
    { label: 'High Press',   pct: highPress,    color: 'rgba(239,68,68,0.45)',  textCol: '#ef4444' },
  ]

  return (
    <div className="space-y-3">
      {/* Simple pitch strip */}
      <div className="relative bg-emerald-950 rounded-xl overflow-hidden border border-emerald-800" style={{ height: 80 }}>
        {/* Pitch lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 300 80" preserveAspectRatio="none">
          <rect x="4" y="4" width="292" height="72" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          <line x1="100" y1="4" x2="100" y2="76" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          <line x1="200" y1="4" x2="200" y2="76" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          {/* Zone fills proportional to intensity */}
          <rect x="4" y="4" width="96" height="72" fill={zones[0].color} />
          <rect x="100" y="4" width="100" height="72" fill={zones[1].color} />
          <rect x="200" y="4" width="96" height="72" fill={zones[2].color} />
          {/* Labels */}
          <text x="52" y="45" textAnchor="middle" fill={zones[0].textCol} fontSize="9" fontWeight="bold">{ownHalf}%</text>
          <text x="150" y="45" textAnchor="middle" fill={zones[1].textCol} fontSize="9" fontWeight="bold">{middleThird}%</text>
          <text x="248" y="45" textAnchor="middle" fill={zones[2].textCol} fontSize="9" fontWeight="bold">{highPress}%</text>
          {/* Arrow showing attack direction */}
          <text x="275" y="44" fill="rgba(255,255,255,0.4)" fontSize="14">→</text>
        </svg>
        {/* Zone labels below */}
        <div className="absolute bottom-1 left-0 right-0 flex text-[8px] text-white/40 px-1 justify-between">
          <span className="w-1/3 text-center">Own Half</span>
          <span className="w-1/3 text-center">Mid Third</span>
          <span className="w-1/3 text-center">High Press</span>
        </div>
      </div>

      {/* Legend dots */}
      <div className="flex justify-around text-xs">
        {zones.map(z => (
          <div key={z.label} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: z.textCol }} />
            <span className="text-muted-foreground">{z.label}</span>
            <span className="font-bold" style={{ color: z.textCol }}>{z.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Metric ring (SVG circle gauge) ───────────────────────────────────────────

function RingGauge({
  value,
  max,
  label,
  color = '#6366f1',
  unit = '',
}: {
  value: number
  max: number
  label: string
  color?: string
  unit?: string
}) {
  const pct   = Math.min(1, value / max)
  const r     = 28
  const circ  = 2 * Math.PI * r
  const dash  = pct * circ

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" viewBox="0 0 72 72">
        {/* Track */}
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
        {/* Progress */}
        <circle
          cx="36" cy="36" r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
        />
        {/* Value text */}
        <text x="36" y="40" textAnchor="middle" fontSize="13" fontWeight="bold" fill="white">
          {typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(1) : value}{unit}
        </text>
      </svg>
      <span className="text-[10px] text-center text-muted-foreground leading-tight w-16">{label}</span>
    </div>
  )
}

// ── Team panel ────────────────────────────────────────────────────────────────

function TeamBuildUpPanel({ team }: { team: TeamTactics }) {
  const b = team.buildUp

  const styleColor =
    b.buildUpStyle === 'Short-Passing' ? 'text-emerald-400' :
    b.buildUpStyle === 'Direct'        ? 'text-amber-400'   :
    b.buildUpStyle === 'Long-Ball'     ? 'text-red-400'     : 'text-blue-400'

  return (
    <div className="space-y-6">
      {/* Style badge */}
      <div>
        <SectionLabel>Build-Up Style</SectionLabel>
        <BuildUpStyleBadge style={b.buildUpStyle} />
      </div>

      {/* Key metrics row */}
      <div>
        <SectionLabel>Ball Control Metrics</SectionLabel>
        <div className="flex flex-wrap justify-around gap-2 py-2">
          <RingGauge value={b.possession}              max={70}  label="Possession %" color="#6366f1" unit="%" />
          <RingGauge value={b.retentionUnderPressure}  max={100} label="Retention %" color="#10b981" unit="%" />
          <RingGauge value={b.progressiveCarriesPer90} max={20}  label="Prog. Carries /90" color="#f59e0b" />
          <RingGauge value={b.passesPerSequence}       max={10}  label="Passes / Seq." color="#3b82f6" />
        </div>
      </div>

      {/* Final-third entries */}
      <div>
        <SectionLabel>Final-Third Entry Methods</SectionLabel>
        <FinalThirdBar
          carry={b.finalThirdEntries.carry}
          pass={b.finalThirdEntries.pass}
          setPiece={b.finalThirdEntries.setPiece}
        />
      </div>

      {/* Pressing trigger map */}
      <div>
        <SectionLabel>Pressing Trigger Zones</SectionLabel>
        <PressTriggerMap
          ownHalf={b.pressTriggerZones.ownHalf}
          middleThird={b.pressTriggerZones.middleThird}
          highPress={b.pressTriggerZones.highPress}
          teamName={team.shortName}
        />
      </div>

      {/* Defensive shape metrics */}
      <div>
        <SectionLabel>Defensive Shape</SectionLabel>
        <div className="space-y-0">
          <StatRow label="Vertical Compactness" value={`${b.compactness}m`} sub="(lower = tighter)" />
          <StatRow label="Counter-Attack Speed" value={`${b.counterAttackSpeed}s`} sub="regain → shot" />
          <StatRow label="PPDA (own half)"  value={b.ppdaOwn}  accent="text-emerald-400" />
          <StatRow label="PPDA (opp. half)" value={b.ppdaOpp}  accent="text-red-400"     />
        </div>
      </div>
    </div>
  )
}

// ── Main exported component ───────────────────────────────────────────────────

interface BuildUpInsightsProps {
  homeTeam: TeamTactics
  awayTeam: TeamTactics
}

export function BuildUpInsights({ homeTeam, awayTeam }: BuildUpInsightsProps) {
  return (
    <div className="space-y-6">
      {/* Possession battle — full width */}
      <div>
        <SectionLabel>Possession Battle</SectionLabel>
        <PossessionGauge home={homeTeam.buildUp.possession} away={awayTeam.buildUp.possession} />
      </div>

      {/* Two-column team panels */}
      <div className="grid md:grid-cols-2 gap-6 pt-2">
        {/* Home */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            {homeTeam.crest && (
              <img src={homeTeam.crest} alt={homeTeam.shortName} className="w-6 h-6 object-contain" />
            )}
            <span className="font-bold text-sm">{homeTeam.shortName}</span>
            <span className="text-xs text-muted-foreground bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">
              Home
            </span>
          </div>
          <TeamBuildUpPanel team={homeTeam} />
        </div>

        {/* Divider */}
        <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-border" />

        {/* Away */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            {awayTeam.crest && (
              <img src={awayTeam.crest} alt={awayTeam.shortName} className="w-6 h-6 object-contain" />
            )}
            <span className="font-bold text-sm">{awayTeam.shortName}</span>
            <span className="text-xs text-muted-foreground bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-full">
              Away
            </span>
          </div>
          <TeamBuildUpPanel team={awayTeam} />
        </div>
      </div>

      {/* Comparative summary row */}
      <div className="border-t pt-4">
        <SectionLabel>Head-to-Head Build-Up Comparison</SectionLabel>
        <div className="space-y-3">
          {[
            {
              label: 'Possession',
              home: homeTeam.buildUp.possession,
              away: awayTeam.buildUp.possession,
              unit: '%',
              higherIsBetter: true,
            },
            {
              label: 'Retention Under Pressure',
              home: homeTeam.buildUp.retentionUnderPressure,
              away: awayTeam.buildUp.retentionUnderPressure,
              unit: '%',
              higherIsBetter: true,
            },
            {
              label: 'Progressive Carries /90',
              home: homeTeam.buildUp.progressiveCarriesPer90,
              away: awayTeam.buildUp.progressiveCarriesPer90,
              unit: '',
              higherIsBetter: true,
            },
            {
              label: 'Compactness (lower = tighter)',
              home: homeTeam.buildUp.compactness,
              away: awayTeam.buildUp.compactness,
              unit: 'm',
              higherIsBetter: false,
            },
          ].map(row => {
            const total   = row.home + row.away
            const homePct = total > 0 ? (row.home / total) * 100 : 50
            const homeBetter = row.higherIsBetter ? row.home >= row.away : row.home <= row.away

            return (
              <div key={row.label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className={`font-semibold tabular-nums ${homeBetter ? 'text-primary' : 'text-muted-foreground'}`}>
                    {row.home}{row.unit}
                  </span>
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className={`font-semibold tabular-nums ${!homeBetter ? 'text-orange-400' : 'text-muted-foreground'}`}>
                    {row.away}{row.unit}
                  </span>
                </div>
                <div className="flex h-2 bg-muted rounded-full overflow-hidden gap-0.5">
                  <div className="bg-primary rounded-full transition-all" style={{ width: `${homePct}%` }} />
                  <div className="bg-orange-500 rounded-full transition-all" style={{ width: `${100 - homePct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

