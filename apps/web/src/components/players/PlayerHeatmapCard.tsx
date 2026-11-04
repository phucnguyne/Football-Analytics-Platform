'use client'

import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
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
  const { data } = useQuery<{ available: boolean; points: HeatPoint[] }>({
    queryKey: ['player-heatmap', player.id],
    queryFn: async () => {
      const response = await fetch(`/api/persons/${player.id}/heatmap`)
      if (!response.ok) throw new Error('Failed to fetch player heatmap')
      return response.json()
    },
    staleTime: 60 * 60 * 1000,
  })

  const { points, zones } = useMemo(() => {
    const points = data?.points ?? []
    const counts = points.reduce((acc, point) => {
      acc.left += point.y < 33 ? 1 : 0
      acc.center += point.y >= 33 && point.y <= 67 ? 1 : 0
      acc.right += point.y > 67 ? 1 : 0
      acc.defensive += point.x < 33 ? 1 : 0
      acc.middle += point.x >= 33 && point.x <= 67 ? 1 : 0
      acc.attacking += point.x > 67 ? 1 : 0
      acc.box += point.x > 82 && point.y > 20 && point.y < 80 ? 1 : 0
      return acc
    }, { left: 0, center: 0, right: 0, defensive: 0, middle: 0, attacking: 0, box: 0 })
    const total = points.length
    return {
      points,
      zones: {
        leftFlank: total ? Math.round(counts.left / total * 100) : 0,
        center: total ? Math.round(counts.center / total * 100) : 0,
        rightFlank: total ? Math.round(counts.right / total * 100) : 0,
        defensiveThird: total ? Math.round(counts.defensive / total * 100) : 0,
        middleThird: total ? Math.round(counts.middle / total * 100) : 0,
        attackingThird: total ? Math.round(counts.attacking / total * 100) : 0,
        boxTouches: counts.box,
        totalTouches: total,
      },
    }
  }, [data])

  const playerData = {
    [player.id]: {
      points,
      zones,
    },
  }

  if (!data?.available) {
    return (
      <div className="bg-card p-6 rounded-2xl border text-center text-sm text-muted-foreground">
        Player heatmap is unavailable because StatsBomb open data has no matching event file for this player.
      </div>
    )
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

