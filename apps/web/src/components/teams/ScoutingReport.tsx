'use client'

import React, { useRef } from 'react'
import Image from 'next/image'
import type { ScoutingReport } from '@/lib/scouting-generator'

// ── Helper Components ─────────────────────────────────────────────────────────

function StatBar({
  label,
  value,
  max,
  color = 'bg-primary',
}: {
  label: string
  value: number
  max: number
  color?: string
}) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{value}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function ResultBadge({ result }: { result: 'W' | 'D' | 'L' }) {
  const styles = {
    W: 'bg-emerald-500 text-white',
    D: 'bg-amber-400 text-black',
    L: 'bg-red-500 text-white',
  }
  return (
    <span className={`inline-flex w-7 h-7 items-center justify-center rounded-full text-xs font-bold ${styles[result]}`}>
      {result}
    </span>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-bold flex items-center gap-2 mb-4 print:text-base">
      <span className="w-1.5 h-5 bg-primary rounded-full print:hidden" />
      {children}
    </h2>
  )
}

function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`bg-card border rounded-2xl p-5 print:border print:rounded-lg ${className}`}>
      {children}
    </div>
  )
}

// ── Formation SVG mini-pitch ──────────────────────────────────────────────────

const FORMATION_POS: Record<string, { x: number; y: number }[]> = {
  '4-3-3': [
    { x: 50, y: 90 }, // GK
    { x: 15, y: 70 }, { x: 37, y: 72 }, { x: 63, y: 72 }, { x: 85, y: 70 }, // DEF
    { x: 25, y: 50 }, { x: 50, y: 48 }, { x: 75, y: 50 }, // MID
    { x: 20, y: 28 }, { x: 50, y: 22 }, { x: 80, y: 28 }, // FWD
  ],
  '4-2-3-1': [
    { x: 50, y: 90 },
    { x: 15, y: 70 }, { x: 37, y: 72 }, { x: 63, y: 72 }, { x: 85, y: 70 },
    { x: 35, y: 55 }, { x: 65, y: 55 },
    { x: 20, y: 38 }, { x: 50, y: 35 }, { x: 80, y: 38 },
    { x: 50, y: 20 },
  ],
  '4-4-2': [
    { x: 50, y: 90 },
    { x: 15, y: 70 }, { x: 37, y: 72 }, { x: 63, y: 72 }, { x: 85, y: 70 },
    { x: 15, y: 50 }, { x: 37, y: 50 }, { x: 63, y: 50 }, { x: 85, y: 50 },
    { x: 35, y: 22 }, { x: 65, y: 22 },
  ],
  '3-5-2': [
    { x: 50, y: 90 },
    { x: 25, y: 72 }, { x: 50, y: 74 }, { x: 75, y: 72 },
    { x: 10, y: 52 }, { x: 30, y: 50 }, { x: 50, y: 48 }, { x: 70, y: 50 }, { x: 90, y: 52 },
    { x: 35, y: 22 }, { x: 65, y: 22 },
  ],
  '3-4-3': [
    { x: 50, y: 90 },
    { x: 25, y: 72 }, { x: 50, y: 74 }, { x: 75, y: 72 },
    { x: 15, y: 52 }, { x: 40, y: 50 }, { x: 60, y: 50 }, { x: 85, y: 52 },
    { x: 20, y: 25 }, { x: 50, y: 20 }, { x: 80, y: 25 },
  ],
  '5-3-2': [
    { x: 50, y: 90 },
    { x: 10, y: 68 }, { x: 28, y: 72 }, { x: 50, y: 74 }, { x: 72, y: 72 }, { x: 90, y: 68 },
    { x: 25, y: 50 }, { x: 50, y: 48 }, { x: 75, y: 50 },
    { x: 35, y: 22 }, { x: 65, y: 22 },
  ],
}

const DEFAULT_POSITIONS: { x: number; y: number }[] = [
  { x: 50, y: 90 },
  { x: 15, y: 70 }, { x: 37, y: 72 }, { x: 63, y: 72 }, { x: 85, y: 70 },
  { x: 25, y: 50 }, { x: 50, y: 48 }, { x: 75, y: 50 },
  { x: 20, y: 28 }, { x: 50, y: 22 }, { x: 80, y: 28 },
]

function FormationMiniPitch({ formation }: { formation: string }) {
  const positions = FORMATION_POS[formation] ?? DEFAULT_POSITIONS

  return (
    <div className="relative w-full aspect-[2/3] bg-emerald-900 rounded-xl overflow-hidden border border-emerald-700">
      {/* Pitch lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 150" preserveAspectRatio="none">
        <rect x="5" y="5" width="90" height="140" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
        <line x1="5" y1="75" x2="95" y2="75" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
        <circle cx="50" cy="75" r="12" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
        {/* Top penalty area */}
        <rect x="25" y="5" width="50" height="20" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
        {/* Bottom penalty area */}
        <rect x="25" y="125" width="50" height="20" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
      </svg>

      {/* Player dots */}
      {positions.map((pos, i) => (
        <div
          key={i}
          className="absolute w-5 h-5 -ml-2.5 -mt-2.5 bg-primary rounded-full border-2 border-white shadow-lg flex items-center justify-center text-[8px] text-white font-bold"
          style={{ left: `${pos.x}%`, top: `${pos.y * 0.667}%` }}
        >
          {i + 1}
        </div>
      ))}

      {/* Formation label */}
      <div className="absolute bottom-2 left-0 right-0 text-center text-white font-bold text-sm drop-shadow">
        {formation}
      </div>
    </div>
  )
}

// ── Attacking Zone Breakdown ──────────────────────────────────────────────────

function ZoneBar({
  left,
  central,
  right,
}: {
  left: number
  central: number
  right: number
}) {
  return (
    <div className="space-y-2">
      <div className="flex text-xs text-muted-foreground justify-between">
        <span>Left</span>
        <span>Central</span>
        <span>Right</span>
      </div>
      <div className="flex h-5 rounded-full overflow-hidden gap-0.5">
        <div className="bg-blue-500 flex items-center justify-center text-white text-[10px] font-bold" style={{ width: `${left}%` }}>{left}%</div>
        <div className="bg-primary flex items-center justify-center text-white text-[10px] font-bold" style={{ width: `${central}%` }}>{central}%</div>
        <div className="bg-orange-500 flex items-center justify-center text-white text-[10px] font-bold" style={{ width: `${right}%` }}>{right}%</div>
      </div>
    </div>
  )
}

// ── PPDA Gauge ────────────────────────────────────────────────────────────────

function PPDAGauge({ ppda }: { ppda: number }) {
  // PPDA: lower = more pressing. Good: <8, Medium: 8-13, Low: >13
  // Invert for visual: 0 = no press, 100 = elite press
  const pressScore = Math.max(0, Math.min(100, ((18 - ppda) / 13) * 100))
  const color = ppda < 8 ? 'text-emerald-400' : ppda < 13 ? 'text-amber-400' : 'text-red-400'
  const label = ppda < 8 ? 'Elite Press' : ppda < 13 ? 'Moderate Press' : 'Low Block'

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-2xl font-black tabular-nums">{ppda.toFixed(1)}</span>
        <span className={`text-xs font-bold ${color}`}>{label}</span>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${ppda < 8 ? 'bg-emerald-500' : ppda < 13 ? 'bg-amber-400' : 'bg-red-500'}`}
          style={{ width: `${pressScore}%` }}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Lower PPDA = higher pressing intensity. Scale: Elite &lt;8, Moderate 8–13, Low Block &gt;13
      </p>
    </div>
  )
}

// ── Rating Orb ────────────────────────────────────────────────────────────────

function RatingOrb({ rating }: { rating: number }) {
  const color =
    rating >= 8 ? 'from-emerald-500 to-green-400' :
    rating >= 6 ? 'from-amber-500 to-yellow-400' :
    'from-red-500 to-rose-400'

  return (
    <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${color} flex flex-col items-center justify-center shadow-lg`}>
      <span className="text-white text-xl font-black leading-none">{rating.toFixed(1)}</span>
      <span className="text-white/80 text-[9px] leading-none mt-0.5">/ 10</span>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

interface ScoutingReportProps {
  report: ScoutingReport
}

export function ScoutingReport({ report }: ScoutingReportProps) {
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = () => {
    window.print()
  }

  const formWins = report.recentForm.filter(r => r.result === 'W').length
  const formDraws = report.recentForm.filter(r => r.result === 'D').length
  const formLosses = report.recentForm.filter(r => r.result === 'L').length

  return (
    <div ref={printRef}>
      {/* Print-only header */}
      <div className="hidden print:block mb-6 border-b pb-4">
        <p className="text-xs text-muted-foreground">
          Football Analytics Platform — Scouting Report · Generated {new Date(report.generatedAt).toLocaleDateString()}
        </p>
      </div>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 mb-8 print:mb-4">
        {report.crest && (
          <Image
            src={report.crest}
            alt={report.teamName}
            width={80}
            height={80}
            className="object-contain print:w-14 print:h-14"
          />
        )}
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-black print:text-2xl">{report.teamName}</h1>
            {report.leaguePosition > 0 && (
              <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-bold border border-primary/20">
                #{report.leaguePosition} Premier League
              </span>
            )}
            <RatingOrb rating={report.overallRating} />
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-sm text-muted-foreground">
            {report.venue && <span>🏟 {report.venue}</span>}
            {report.founded && <span>📅 Est. {report.founded}</span>}
            {report.playedGames > 0 && (
              <span>
                {report.playedGames} games · <strong className="text-foreground">{report.points} pts</strong> ·&nbsp;
                <span className="text-emerald-400">{report.wins}W</span>&nbsp;
                <span className="text-amber-400">{report.draws}D</span>&nbsp;
                <span className="text-red-400">{report.losses}L</span>
              </span>
            )}
          </div>
        </div>

        {/* Print button (hidden in print mode) */}
        <button
          onClick={handlePrint}
          className="print:hidden px-4 py-2 bg-muted hover:bg-muted/80 border rounded-xl text-sm font-medium flex items-center gap-2 transition-colors"
        >
          🖨️ Export PDF
        </button>
      </div>

      {/* ── Grid layout ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 print:grid-cols-3 print:gap-3">

        {/* ── Formation & Tactics ──────────────────────────────────────────── */}
        <Card className="lg:col-span-1">
          <SectionTitle>Formation & Tactics</SectionTitle>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-2">🏠 Home</p>
              <FormationMiniPitch formation={report.formationTendency.home} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">✈️ Away</p>
              <FormationMiniPitch formation={report.formationTendency.away} />
            </div>
            <p className="text-xs text-muted-foreground italic leading-relaxed border-t pt-3">
              {report.formationTendency.description}
            </p>
          </div>
        </Card>

        {/* ── Attacking Patterns + Defensive Profile ───────────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Attacking */}
          <Card>
            <SectionTitle>Attacking Patterns</SectionTitle>
            <div className="grid sm:grid-cols-2 gap-5">
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Attack Zone Distribution</p>
                  <ZoneBar
                    left={report.attackingPattern.leftFlank}
                    central={report.attackingPattern.central}
                    right={report.attackingPattern.rightFlank}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Play Style</span>
                  <span className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-bold">
                    {report.attackingPattern.style}
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                <StatBar label="Shots / Game" value={report.attackingPattern.avgShotsPerGame} max={20} />
                <StatBar label="Chances Created / Game" value={report.attackingPattern.chancesCreatedPerGame} max={16} color="bg-amber-500" />
                <StatBar label="Crosses / Game" value={report.attackingPattern.crossesPerGame} max={35} color="bg-blue-500" />
                <StatBar label="Set-Piece Efficiency %" value={report.attackingPattern.setPickEfficiency} max={40} color="bg-purple-500" />
              </div>
            </div>
          </Card>

          {/* Defensive */}
          <Card>
            <SectionTitle>Defensive Profile</SectionTitle>
            <div className="grid sm:grid-cols-2 gap-5">
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Pressing Intensity (PPDA)</p>
                  <PPDAGauge ppda={report.defensiveProfile.ppda} />
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  {[
                    { label: 'Block Type', value: report.defensiveProfile.blockType },
                    { label: 'Line Height', value: report.defensiveProfile.defensiveLineHeight },
                    { label: 'Press', value: report.defensiveProfile.pressIntensity },
                  ].map(tag => (
                    <span key={tag.label} className="px-2 py-1 bg-muted rounded-lg text-xs">
                      <span className="text-muted-foreground">{tag.label}: </span>
                      <strong>{tag.value}</strong>
                    </span>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <StatBar label="Tackles / Game" value={report.defensiveProfile.tacklesPerGame} max={30} color="bg-slate-500" />
                <StatBar label="Interceptions / Game" value={report.defensiveProfile.interceptionsPerGame} max={16} color="bg-indigo-500" />
                <StatBar label="Aerial Duels Won %" value={report.defensiveProfile.aerialDuelsWon} max={80} color="bg-teal-500" />
                <StatBar label="Clean Sheet Rate %" value={report.defensiveProfile.cleanSheetRate} max={60} color="bg-emerald-500" />
                <div className="pt-2">
                  <p className="text-xs text-muted-foreground mb-1">⚠️ Vulnerable Zones</p>
                  <div className="flex flex-wrap gap-1.5">
                    {report.defensiveProfile.weakZones.map(z => (
                      <span key={z} className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full text-xs">
                        {z}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* ── Key Players ──────────────────────────────────────────────────── */}
        <Card className="lg:col-span-2">
          <SectionTitle>Key Players</SectionTitle>
          <div className="space-y-3">
            {report.keyPlayers.map((player, i) => (
              <div
                key={player.id}
                className="flex items-center gap-4 p-3 bg-muted/30 rounded-xl border hover:border-border transition-colors"
              >
                {/* Rank */}
                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-black flex items-center justify-center shrink-0">
                  {i + 1}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold truncate">{player.name}</span>
                    <span className="px-1.5 py-0.5 bg-muted rounded text-[10px] text-muted-foreground shrink-0">
                      {player.position?.replace('_', ' ')}
                    </span>
                    <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full text-[10px] font-bold shrink-0">
                      {player.role}
                    </span>
                  </div>
                  {player.nationality && (
                    <div className="text-xs text-muted-foreground mt-0.5">{player.nationality}</div>
                  )}
                </div>

                {/* Stats */}
                <div className="hidden sm:grid grid-cols-4 gap-3 text-center shrink-0">
                  {[
                    { label: 'G', value: player.goals },
                    { label: 'A', value: player.assists },
                    { label: 'xG', value: player.xG.toFixed(1) },
                    { label: 'xA', value: player.xA.toFixed(1) },
                  ].map(s => (
                    <div key={s.label}>
                      <div className="text-[10px] text-muted-foreground">{s.label}</div>
                      <div className="text-sm font-bold tabular-nums">{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* xG mini bar */}
                <div className="w-20 hidden lg:block shrink-0">
                  <StatBar label="xG" value={player.xG} max={20} color="bg-emerald-500" />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Recent Form ──────────────────────────────────────────────────── */}
        <Card className="lg:col-span-1">
          <SectionTitle>Recent Form</SectionTitle>
          <div className="flex gap-2 mb-4">
            {report.recentForm.map((r, i) => (
              <ResultBadge key={i} result={r.result} />
            ))}
          </div>
          <div className="flex gap-3 text-sm mb-4">
            <span className="text-emerald-400 font-bold">{formWins}W</span>
            <span className="text-amber-400 font-bold">{formDraws}D</span>
            <span className="text-red-400 font-bold">{formLosses}L</span>
          </div>
          <div className="space-y-2">
            {report.recentForm.map((r, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                <ResultBadge result={r.result} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs truncate">{r.isHome ? 'vs' : '@'} {r.opponent}</div>
                  {r.matchday > 0 && <div className="text-[10px] text-muted-foreground">MD {r.matchday}</div>}
                </div>
                <div className="text-sm font-bold tabular-nums">{r.score}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Set Piece Analysis ───────────────────────────────────────────── */}
        <Card className="lg:col-span-1">
          <SectionTitle>Set Piece Analysis</SectionTitle>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-center">
              {[
                { label: 'Corners / Game', value: report.setPieceStats.cornersPerGame.toFixed(1) },
                { label: 'Corner Conversion', value: `${report.setPieceStats.cornerConversionRate.toFixed(1)}%` },
                { label: 'Goals from SP', value: report.setPieceStats.setPieceGoalsFor },
                { label: 'Goals vs SP', value: report.setPieceStats.setPieceGoalsAgainst },
                { label: 'FK Goals', value: report.setPieceStats.freeKickGoals },
                { label: 'Throw-in Style', value: report.setPieceStats.throwInStrategy },
              ].map(s => (
                <div key={s.label} className="bg-muted/30 rounded-xl p-3">
                  <div className="text-xs text-muted-foreground mb-1">{s.label}</div>
                  <div className="text-lg font-bold">{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* ── Strengths & Weaknesses ───────────────────────────────────────── */}
        <Card className="lg:col-span-2">
          <SectionTitle>Analyst Summary</SectionTitle>
          <div className="grid sm:grid-cols-2 gap-5 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-emerald-400 mb-2 flex items-center gap-1.5">
                <span>✅</span> Strengths
              </h3>
              <ul className="space-y-2">
                {report.strengthsWeaknesses.strengths.map((s, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-2">
                    <span className="text-emerald-400 mt-0.5">▸</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-1.5">
                <span>⚠️</span> Weaknesses
              </h3>
              <ul className="space-y-2">
                {report.strengthsWeaknesses.weaknesses.map((w, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-2">
                    <span className="text-red-400 mt-0.5">▸</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="border-t pt-4">
            <h3 className="text-xs font-semibold text-muted-foreground mb-1.5">📋 Analyst Note</h3>
            <p className="text-sm italic text-muted-foreground leading-relaxed">
              "{report.strengthsWeaknesses.analystNote}"
            </p>
          </div>
        </Card>

      </div>

      {/* Print footer */}
      <div className="hidden print:block mt-8 pt-4 border-t text-xs text-muted-foreground text-center">
        Football Analytics Platform · Confidential Scouting Report · {new Date(report.generatedAt).toLocaleString()}
      </div>
    </div>
  )
}

