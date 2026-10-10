'use client'

import React from 'react'

interface ShotMapProps {
  matchId: string
  homeTeam: { id: number; name: string; shortName: string }
  awayTeam: { id: number; name: string; shortName: string }
  events: any[]
}

export function ShotMap({ homeTeam, awayTeam, events }: ShotMapProps) {
  const shots = events.filter(e => 
    (e.type === 'SHOT' || e.type === 'GOAL' || e.type === 'PENALTY_GOAL' || e.eventType === 'goal') && 
    e.x !== undefined && e.x !== null && 
    e.y !== undefined && e.y !== null
  )

  if (shots.length === 0) {
    return (
      <div className="bg-card p-6 rounded-2xl border text-center text-muted-foreground">
        Shot Map data not available for this match.
      </div>
    )
  }

  return (
    <div className="bg-card rounded-2xl border p-6">
      <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
        <span className="w-2 h-6 bg-primary rounded-full" />
        Shot Map & xG
      </h3>
      
      <div className="flex justify-between text-sm mb-4 font-semibold">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span>{homeTeam.shortName || homeTeam.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span>{awayTeam.shortName || awayTeam.name}</span>
        </div>
      </div>

      <div className="relative w-full aspect-[2/1] bg-green-700/90 rounded-lg overflow-hidden border-2 border-white/80 shadow-inner">
        {/* Pitch Markings */}
        <div className="absolute top-0 bottom-0 left-1/2 w-0 border-l-2 border-white/60"></div>
        <div className="absolute top-1/2 left-1/2 w-[20%] aspect-square -translate-x-1/2 -translate-y-1/2 border-2 border-white/60 rounded-full"></div>
        <div className="absolute top-1/2 left-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 bg-white/60 rounded-full"></div>
        
        {/* Penalty Areas */}
        <div className="absolute top-[20%] bottom-[20%] left-0 w-[16%] border-2 border-white/60 border-l-0"></div>
        <div className="absolute top-[20%] bottom-[20%] right-0 w-[16%] border-2 border-white/60 border-r-0"></div>

        {/* 6 Yard Boxes */}
        <div className="absolute top-[35%] bottom-[35%] left-0 w-[5%] border-2 border-white/60 border-l-0"></div>
        <div className="absolute top-[35%] bottom-[35%] right-0 w-[5%] border-2 border-white/60 border-r-0"></div>

        {/* Penalty Spots */}
        <div className="absolute top-1/2 left-[11%] w-1.5 h-1.5 -translate-y-1/2 bg-white/60 rounded-full"></div>
        <div className="absolute top-1/2 right-[11%] w-1.5 h-1.5 -translate-y-1/2 bg-white/60 rounded-full"></div>

        {/* Shots */}
        {shots.map((shot, i) => {
          let x = shot.x
          let y = shot.y
          const isHome = shot.team?.id === homeTeam.id || shot.team === 'HOME'
          
          if (!isHome) {
            // Away attacks left (X: 0 to 1 -> 100% to 0%)
            x = 1 - x
            y = 1 - y
          }

          const isGoal = shot.type === 'GOAL' || shot.type === 'PENALTY_GOAL' || shot.eventType === 'goal'
          const size = Math.max(6, (shot.xG || 0.1) * 35)

          return (
            <div
              key={shot.id || i}
              title={`${shot.minute}' - ${isGoal ? 'Goal' : 'Shot'} (xG: ${shot.xG?.toFixed(2) || 'N/A'}) by ${shot.scorer?.name || shot.player?.name || 'Unknown'}`}
              className={`absolute rounded-full transform -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-150 cursor-crosshair
                ${isHome ? 'bg-blue-500' : 'bg-red-500'}
                ${isGoal ? 'border-[3px] border-white z-10' : 'opacity-80 border border-black/20'}
              `}
              style={{
                left: `${x * 100}%`,
                top: `${y * 100}%`,
                width: `${size}px`,
                height: `${size}px`,
              }}
            ></div>
          )
        })}
      </div>
      
      <div className="mt-4 text-xs text-muted-foreground flex gap-6 justify-center">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-neutral-400 opacity-80 border border-black/20"></div>
          <span>Shot</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-neutral-400 border-[3px] border-white ring-1 ring-black/20"></div>
          <span>Goal</span>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <div className="w-1 h-1 rounded-full bg-neutral-400"></div>
          <div className="w-2 h-2 rounded-full bg-neutral-400"></div>
          <div className="w-4 h-4 rounded-full bg-neutral-400"></div>
          <span className="ml-1">Circle size = xG</span>
        </div>
      </div>
    </div>
  )
}

