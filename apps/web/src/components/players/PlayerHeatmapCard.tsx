'use client'

import React, { useMemo } from 'react'
import { PlayerHeatmap } from '@/components/tactics/PlayerHeatmap'
import type { HeatPoint, ZoneBreakdown } from '@/lib/tactics-generator'

interface PlayerHeatmapCardProps {
  player: {
    id: number
    name: string
    position?: string
  }
}

export function PlayerHeatmapCard({ player }: PlayerHeatmapCardProps) {
  // Generate deterministic season heat density points for the player
  const { points, zones } = useMemo(() => {
    const seed = player.id * 17
    const pos = (player.position || 'MIDFIELDER').toUpperCase()

    let baseX = 50
    let baseY = 50
    let spreadX = 20
    let spreadY = 22

    if (pos.includes('GOAL')) {
      baseX = 12
      baseY = 50
      spreadX = 8
      spreadY = 16
    } else if (pos.includes('DEF')) {
      baseX = 32
      baseY = seed % 2 === 0 ? 30 : 70
      spreadX = 18
      spreadY = 22
    } else if (pos.includes('MID')) {
      baseX = 52
      baseY = 50
      spreadX = 24
      spreadY = 28
    } else {
      // Forward / Attacker
      baseX = 74
      baseY = 50
      spreadX = 18
      spreadY = 26
    }

    const generatedPoints: HeatPoint[] = []
    let leftCount = 0
    let centerCount = 0
    let rightCount = 0
    let defThird = 0
    let midThird = 0
    let attThird = 0
    let boxTouches = 0

    const totalPts = 70
    for (let i = 0; i < totalPts; i++) {
      const angle = Math.sin(seed + i * 19) * Math.PI * 2
      const dist = Math.abs(Math.sin(seed + i * 31))

      const px = Math.min(94, Math.max(6, Math.round(baseX + Math.cos(angle) * dist * spreadX)))
      const py = Math.min(94, Math.max(6, Math.round(baseY + Math.sin(angle) * dist * spreadY)))
      const intensity = 0.4 + Math.abs(Math.sin(seed + i * 7)) * 0.6

      generatedPoints.push({ x: px, y: py, intensity })

      if (py < 33) leftCount++
      else if (py > 67) rightCount++
      else centerCount++

      if (px < 33) defThird++
      else if (px > 67) attThird++
      else midThird++

      if (px > 82 && py > 20 && py < 80) boxTouches++
    }

    const zoneBreakdown: ZoneBreakdown = {
      leftFlank: Math.round((leftCount / totalPts) * 100),
      center: Math.round((centerCount / totalPts) * 100),
      rightFlank: Math.round((rightCount / totalPts) * 100),
      defensiveThird: Math.round((defThird / totalPts) * 100),
      middleThird: Math.round((midThird / totalPts) * 100),
      attackingThird: Math.round((attThird / totalPts) * 100),
      boxTouches,
      totalTouches: totalPts * 14,
    }

    return { points: generatedPoints, zones: zoneBreakdown }
  }, [player.id, player.position])

  const playerData = {
    [player.id]: {
      points,
      zones,
    },
  }

  return (
    <div className="bg-card p-6 rounded-2xl border space-y-4">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-6 bg-rose-500 rounded-full" />
            <h3 className="text-lg font-bold">Season Heatmap & Operating Area</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Spatial touch distribution and corridor bias across all matches
          </p>
        </div>
        <span className="text-xs font-bold bg-muted px-2.5 py-1 rounded-md text-foreground">
          {player.position?.replace('_', ' ') || 'Player'}
        </span>
      </div>

      <PlayerHeatmap
        teamPoints={points}
        playersData={playerData}
        teamName={player.name}
        singlePlayerMode={true}
        selectedPlayerId={player.id}
      />
    </div>
  )
}

