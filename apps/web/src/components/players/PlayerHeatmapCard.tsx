'use client'

import { useTranslations } from 'next-intl'
import { DataSourceLabel } from '@/components/ui/DataSourceLabel'
import React, { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { ChartSkeleton } from '@/components/ui/Skeleton'
import { useQuery } from '@tanstack/react-query'
import type { HeatPoint } from '@/lib/tactics-generator'
import { PitchCanvas } from '@/components/tactics/PitchCanvas'

const PlayerHeatmap = dynamic(
  () => import('@/components/tactics/PlayerHeatmap').then((module) => ({ default: module.PlayerHeatmap })),
  {
    loading: () => <ChartSkeleton className="h-[480px]" />,
    ssr: false,
  },
)

interface PlayerHeatmapCardProps {
  player: {
    id: number
    name: string
    position?: string
  }
}

export function PlayerHeatmapCard({ player }: PlayerHeatmapCardProps) {
  const t = useTranslations('Player')
  const [view, setView] = useState<'heatmap' | 'shots'>('heatmap')
  const { data, isPending } = useQuery<{
    available: boolean
    points: (HeatPoint & { xG?: number | null })[]
    source: string
    season?: number
    matchCount: number
  }>({
    queryKey: ['player-heatmap', player.id, view],
    queryFn: async () => {
      const response = await fetch(`/api/persons/${player.id}/heatmap?view=${view}`)
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

  const season = data?.season ? `${data.season}/${String(data.season + 1).slice(-2)}` : null
  const provider = view === 'shots' ? 'Understat via pl-catalogue'
    : data?.source === 'wyscout-open-data' ? 'Wyscout Open Data' : 'StatsBomb Open Data'
  return (
    <div className="bg-card p-6 rounded-2xl border space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-6 bg-rose-500 rounded-full" />
            <h3 className="text-lg font-bold">{t(view === 'shots' ? 'shotMap' : 'heatmap')}{season ? ` · ${season}` : ''}</h3>
            {data?.available && <DataSourceLabel kind="real" detail={provider} />}
          </div>
          {data?.available && (
            <p className="text-xs text-muted-foreground mt-0.5">{t('mapCoverage', { count: data.matchCount })}</p>
          )}
        </div>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {(['heatmap', 'shots'] as const).map((option) => (
            <button key={option} type="button" aria-pressed={view === option} onClick={() => setView(option)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${view === option ? 'bg-background' : 'text-muted-foreground'}`}>
              {t(option === 'shots' ? 'shotMap' : 'heatmap')}
            </button>
          ))}
        </div>
      </div>

      {isPending ? <ChartSkeleton className="h-[480px]" /> : !data?.available ? (
        <p className="py-3 text-center text-sm text-muted-foreground">
          {t(view === 'shots' ? 'shotMapUnavailable' : 'heatmapUnavailable')}
        </p>
      ) : view === 'shots' ? (
        <PitchCanvas theme="tactical-dark">
          {data.points.map(({ x, y, xG }, index) => (
            <span key={index} className="absolute block -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-amber-400/90"
              title={xG == null ? t('shotMap') : `xG ${xG.toFixed(2)}`}
              style={{ left: `${x}%`, top: `${y}%`, width: 7 + (xG ?? 0) * 16, height: 7 + (xG ?? 0) * 16 }} />
          ))}
        </PitchCanvas>
      ) : (
        <PlayerHeatmap teamPoints={points} playersData={playerData} singlePlayerMode selectedPlayerId={player.id} />
      )}
      {data?.available && data.source === 'wyscout-open-data' && (
        <p className="text-xs text-muted-foreground">
          <a className="underline" href="https://figshare.com/articles/dataset/Events/7770599">Wyscout · Pappalardo &amp; Massucco · CC BY 4.0</a>
        </p>
      )}
      {data?.available && data.source === 'understat-shots' && (
        <a className="text-xs text-muted-foreground underline" href="https://github.com/oladeeayo/pl-catalogue">pl-catalogue</a>
      )}
    </div>
  )
}

