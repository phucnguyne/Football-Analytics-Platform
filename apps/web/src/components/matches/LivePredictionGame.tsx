'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

export function LivePredictionGame({ matchId, homeTeam, awayTeam, isLive }: { matchId: string, homeTeam: any, awayTeam: any, isLive: boolean }) {
  const [prediction, setPrediction] = useState<string | null>(null)
  
  if (!isLive) return null;

  return (
    <div className="bg-card p-6 rounded-2xl border mb-6 relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/10 to-transparent opacity-50" />
      
      <h3 className="text-lg font-bold mb-2 flex items-center gap-2 relative z-10">
        <span>🎯</span> Live Prediction
      </h3>
      <p className="text-xs text-muted-foreground mb-4 relative z-10">Who will score the next goal?</p>

      <div className="space-y-2 relative z-10">
        {[
          { id: 'home', label: homeTeam.shortName || homeTeam.name, pct: 42 },
          { id: 'away', label: awayTeam.shortName || awayTeam.name, pct: 28 },
          { id: 'none', label: 'No more goals', pct: 30 }
        ].map(option => {
          const isSelected = prediction === option.id;
          
          return (
            <button
              key={option.id}
              onClick={() => setPrediction(option.id)}
              disabled={prediction !== null}
              className={cn(
                "w-full flex items-center justify-between p-3 rounded-lg border text-sm font-medium transition-all",
                prediction === null ? "hover:bg-muted/50 hover:border-primary/50" : "",
                isSelected ? "bg-primary/20 border-primary text-primary" : (prediction !== null ? "bg-muted/30 border-transparent opacity-60" : "bg-card border-border")
              )}
            >
              <span>{option.label}</span>
              {prediction !== null && (
                <span className="font-bold">{option.pct}%</span>
              )}
            </button>
          )
        })}
      </div>

      {prediction && (
        <div className="mt-4 text-center text-xs font-semibold text-amber-500 animate-in fade-in slide-in-from-bottom-2">
          Prediction locked! +10 XP if correct.
        </div>
      )}
    </div>
  )
}

