'use client'

import React, { useState, useRef, useEffect } from 'react'
import { PitchCanvas } from './PitchCanvas'
import type { HeatPoint, ZoneBreakdown } from '@/lib/tactics-generator'

interface PlayerOption {
  id: number
  name: string
  shirtNumber?: number
  position?: string
}

interface PlayerHeatmapProps {
  teamPoints: HeatPoint[]
  playersData?: Record<number, { points: HeatPoint[]; zones: ZoneBreakdown }>
  playersList?: PlayerOption[]
  teamName: string
  singlePlayerMode?: boolean
  selectedPlayerId?: number
}

export function PlayerHeatmap({
  teamPoints,
  playersData = {},
  playersList = [],
  teamName,
  singlePlayerMode = false,
  selectedPlayerId: initialPlayerId,
}: PlayerHeatmapProps) {
  const [selectedId, setSelectedId] = useState<number | 'team'>(
    singlePlayerMode && initialPlayerId ? initialPlayerId : 'team'
  )

  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Current active points & zone breakdown
  const isTeam = selectedId === 'team'
  const activeData = !isTeam && playersData[selectedId] ? playersData[selectedId] : null
  const currentPoints = isTeam
    ? teamPoints
    : activeData
    ? activeData.points
    : teamPoints

  const currentZones: ZoneBreakdown = activeData
    ? activeData.zones
    : {
        leftFlank: 31,
        center: 38,
        rightFlank: 31,
        defensiveThird: 28,
        middleThird: 44,
        attackingThird: 28,
        boxTouches: 14,
        totalTouches: teamPoints.length * 2,
      }

  // Draw smooth thermal heat map using Canvas 2D
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height
    ctx.clearRect(0, 0, width, height)

    // Temporary canvas for drawing radial intensity spots
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = width
    tempCanvas.height = height
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) return

    // Draw blurred spots
    currentPoints.forEach((pt) => {
      const cx = (pt.x / 100) * width
      const cy = (pt.y / 100) * height
      const radius = isTeam ? 24 : 32

      const radGrad = tempCtx.createRadialGradient(cx, cy, 0, cx, cy, radius)
      radGrad.addColorStop(0, `rgba(0,0,0,${pt.intensity * 0.45})`)
      radGrad.addColorStop(1, 'rgba(0,0,0,0)')

      tempCtx.fillStyle = radGrad
      tempCtx.beginPath()
      tempCtx.arc(cx, cy, radius, 0, Math.PI * 2)
      tempCtx.fill()
    })

    // Colorize alpha levels using thermal palette
    const imgData = tempCtx.getImageData(0, 0, width, height)
    const data = imgData.data

    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3]
      if (alpha > 0) {
        // Map alpha to temperature gradient: cyan -> lime -> yellow -> red
        const normalized = alpha / 255
        let r = 0, g = 0, b = 0, a = alpha * 0.9

        if (normalized < 0.25) {
          // Cyan to Green
          const t = normalized / 0.25
          r = 0
          g = Math.floor(180 * t)
          b = Math.floor(255 * (1 - t * 0.4))
        } else if (normalized < 0.55) {
          // Green to Yellow
          const t = (normalized - 0.25) / 0.3
          r = Math.floor(255 * t)
          g = 220
          b = 0
        } else if (normalized < 0.8) {
          // Yellow to Orange
          const t = (normalized - 0.55) / 0.25
          r = 255
          g = Math.floor(220 * (1 - t * 0.5))
          b = 0
        } else {
          // Orange to Dark Red / Magenta
          const t = (normalized - 0.8) / 0.2
          r = 255
          g = Math.floor(110 * (1 - t))
          b = Math.floor(40 * t)
        }

        data[i] = r
        data[i + 1] = g
        data[i + 2] = b
        data[i + 3] = a
      }
    }

    ctx.putImageData(imgData, 0, 0)
  }, [currentPoints, isTeam])

  return (
    <div className="space-y-4">
      {/* Controls / Player Selector */}
      {!singlePlayerMode && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-4 rounded-xl border">
          <div>
            <h4 className="font-bold text-sm tracking-tight">Operating Areas & Heatmap</h4>
            <p className="text-xs text-muted-foreground">
              Touch density distribution across tactical pitch zones
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedId('team')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedId === 'team'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground'
              }`}
            >
              Full Team
            </button>

            {playersList.length > 0 && (
              <select
                value={selectedId}
                onChange={(e) => {
                  const val = e.target.value
                  setSelectedId(val === 'team' ? 'team' : Number(val))
                }}
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="team">Select Lineup Player...</option>
                {playersList.map((p) => (
                  <option key={p.id} value={p.id}>
                    #{p.shirtNumber || '-'} {p.name} ({p.position || 'Player'})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      {/* Heatmap Pitch */}
      <PitchCanvas theme="tactical-dark" showThirds={true}>
        <canvas
          ref={canvasRef}
          width={600}
          height={400}
          className="w-full h-full object-cover pointer-events-none opacity-90 mix-blend-screen"
        />
      </PitchCanvas>

      {/* Thermal Scale Legend */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground px-2">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" /> Low Density
        </span>
        <div className="h-1.5 w-32 rounded-full bg-gradient-to-r from-cyan-400 via-lime-400 via-yellow-400 to-red-600 shadow-inner" />
        <span className="flex items-center gap-1.5">
          High Density <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" />
        </span>
      </div>

      {/* Tactical Operating Zones Breakdown */}
      <div className="grid sm:grid-cols-2 gap-3">
        {/* Pitch Thirds */}
        <div className="bg-card p-4 rounded-xl border space-y-2">
          <div className="flex justify-between items-center text-xs font-bold">
            <span className="text-muted-foreground uppercase tracking-wider text-[10px]">
              Pitch Thirds Activity
            </span>
            <span>{currentZones.totalTouches} Touches</span>
          </div>

          <div className="h-3 w-full rounded-md overflow-hidden flex bg-muted">
            <div
              style={{ width: `${currentZones.defensiveThird}%` }}
              className="bg-blue-500/80 hover:opacity-90 transition-all"
              title={`Defensive 3rd: ${currentZones.defensiveThird}%`}
            />
            <div
              style={{ width: `${currentZones.middleThird}%` }}
              className="bg-sky-400 hover:opacity-90 transition-all"
              title={`Middle 3rd: ${currentZones.middleThird}%`}
            />
            <div
              style={{ width: `${currentZones.attackingThird}%` }}
              className="bg-rose-500 hover:opacity-90 transition-all"
              title={`Attacking 3rd: ${currentZones.attackingThird}%`}
            />
          </div>

          <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
            <span className="text-blue-400">Def {currentZones.defensiveThird}%</span>
            <span className="text-sky-400">Mid {currentZones.middleThird}%</span>
            <span className="text-rose-400">Att {currentZones.attackingThird}%</span>
          </div>
        </div>

        {/* Flank Bias */}
        <div className="bg-card p-4 rounded-xl border space-y-2">
          <div className="flex justify-between items-center text-xs font-bold">
            <span className="text-muted-foreground uppercase tracking-wider text-[10px]">
              Flank Bias & Operating Corridor
            </span>
            <span className="text-amber-500">{currentZones.boxTouches} Box Touches</span>
          </div>

          <div className="h-3 w-full rounded-md overflow-hidden flex bg-muted">
            <div
              style={{ width: `${currentZones.leftFlank}%` }}
              className="bg-indigo-500/80 transition-all"
              title={`Left Flank: ${currentZones.leftFlank}%`}
            />
            <div
              style={{ width: `${currentZones.center}%` }}
              className="bg-emerald-500/80 transition-all"
              title={`Central: ${currentZones.center}%`}
            />
            <div
              style={{ width: `${currentZones.rightFlank}%` }}
              className="bg-indigo-500/80 transition-all"
              title={`Right Flank: ${currentZones.rightFlank}%`}
            />
          </div>

          <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
            <span>Left {currentZones.leftFlank}%</span>
            <span className="text-emerald-400">Center {currentZones.center}%</span>
            <span>Right {currentZones.rightFlank}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}

