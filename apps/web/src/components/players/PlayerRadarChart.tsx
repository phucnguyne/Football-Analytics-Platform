'use client'

import React from 'react'
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts'

interface PlayerStats {
  xG: number
  xA: number
  shotsPer90: number
  passCompletion: number
  progressivePasses: number
  tacklesPer90: number
  interceptions: number
  dribblesSuccess: number
}

interface PlayerRadarProps {
  playerStats: PlayerStats | null
  positionalAverages: PlayerStats | null
  playerName: string
  position: string
}

const LABEL_MAP: Record<string, string> = {
  xG: 'xG',
  xA: 'xA',
  shotsPer90: 'Shots/90',
  passCompletion: 'Pass %',
  progressivePasses: 'Prog Passes',
  tacklesPer90: 'Tackles/90',
  interceptions: 'Ints',
  dribblesSuccess: 'Dribble %',
}

// Function to normalize the stats relative to the positional average for the radar shape
function normalizeStats(player: PlayerStats, avg: PlayerStats) {
  // We'll define a max theoretical value for scaling
  const maxValues: Record<keyof PlayerStats, number> = {
    xG: 1.0,
    xA: 0.6,
    shotsPer90: 5.0,
    passCompletion: 100,
    progressivePasses: 10,
    tacklesPer90: 5.0,
    interceptions: 4.0,
    dribblesSuccess: 100
  }

  const keys = Object.keys(maxValues) as Array<keyof PlayerStats>

  return keys.map((key) => {
    const label = LABEL_MAP[key] || key

    const pValue = player[key] || 0
    const aValue = avg[key] || 0
    const max = maxValues[key] || 1

    return {
      subject: label,
      Player: Math.min((pValue / max) * 100, 100), // scale to 0-100
      Average: Math.min((aValue / max) * 100, 100),
      // Keep original values for tooltip
      originalPlayer: Number(pValue.toFixed(2)),
      originalAvg: Number(aValue.toFixed(2))
    }
  })
}

export function PlayerRadarChart({ playerStats, positionalAverages, playerName, position }: PlayerRadarProps) {
  if (!playerStats || !positionalAverages) {
    return (
      <div className="bg-card p-6 rounded-2xl border text-center text-muted-foreground">
        Advanced stats not available for {playerName}.
      </div>
    )
  }

  const data = normalizeStats(playerStats, positionalAverages)

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover text-popover-foreground border shadow-lg p-3 rounded-lg text-sm">
          <p className="font-bold mb-2">{payload[0].payload.subject}</p>
          <div className="flex flex-col gap-1">
            <span className="text-primary font-medium">
              {playerName}: {payload[0].payload.originalPlayer}
            </span>
            <span className="text-muted-foreground">
              Avg {position}: {payload[0].payload.originalAvg}
            </span>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-card p-6 rounded-2xl border h-[400px] flex flex-col">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <span className="text-xl">🎯</span> Radar Profile
      </h3>
      <div className="flex-1 w-full relative -ml-4">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid stroke="currentColor" className="text-border" />
            <PolarAngleAxis 
              dataKey="subject" 
              tick={{ fill: 'currentColor', fontSize: 11 }} 
              className="text-muted-foreground font-medium"
            />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              name={playerName}
              dataKey="Player"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.4}
            />
            <Radar
              name={`Avg ${position}`}
              dataKey="Average"
              stroke="hsl(var(--muted-foreground))"
              fill="hsl(var(--muted-foreground))"
              fillOpacity={0.1}
              strokeDasharray="3 3"
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

