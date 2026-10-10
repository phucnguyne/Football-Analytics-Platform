'use client'

import React from 'react'

interface PredictionProps {
  prediction: {
    homeWin: number
    draw: number
    awayWin: number
  } | null
  homeTeamName: string
  awayTeamName: string
}

export function AlgorithmicPrediction({ prediction, homeTeamName, awayTeamName }: PredictionProps) {
  if (!prediction) return null;

  const homePct = (prediction.homeWin * 100).toFixed(1);
  const drawPct = (prediction.draw * 100).toFixed(1);
  const awayPct = (prediction.awayWin * 100).toFixed(1);

  return (
    <div className="bg-card p-6 rounded-2xl border mb-6">
      <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
        <span className="w-2 h-6 bg-purple-500 rounded-full" />
        AI Match Prediction
      </h3>
      <p className="text-sm text-muted-foreground mb-6">
        Based on historical team strength and Poisson distribution modeling.
      </p>

      <div className="relative h-12 flex rounded-xl overflow-hidden mb-4 border border-border">
        {/* Home */}
        <div 
          style={{ width: `${homePct}%` }} 
          className="bg-blue-500 flex items-center justify-center text-white font-bold text-sm overflow-hidden whitespace-nowrap transition-all duration-1000"
          title={`${homeTeamName} Win: ${homePct}%`}
        >
          {parseFloat(homePct) > 15 ? `${homePct}%` : ''}
        </div>
        
        {/* Draw */}
        <div 
          style={{ width: `${drawPct}%` }} 
          className="bg-neutral-400 flex items-center justify-center text-white font-bold text-sm overflow-hidden whitespace-nowrap transition-all duration-1000"
          title={`Draw: ${drawPct}%`}
        >
          {parseFloat(drawPct) > 15 ? `${drawPct}%` : ''}
        </div>
        
        {/* Away */}
        <div 
          style={{ width: `${awayPct}%` }} 
          className="bg-red-500 flex items-center justify-center text-white font-bold text-sm overflow-hidden whitespace-nowrap transition-all duration-1000"
          title={`${awayTeamName} Win: ${awayPct}%`}
        >
          {parseFloat(awayPct) > 15 ? `${awayPct}%` : ''}
        </div>
      </div>

      <div className="flex justify-between text-sm font-semibold">
        <div className="text-blue-500 truncate w-1/3 text-left">
          {homeTeamName}
        </div>
        <div className="text-neutral-500 w-1/3 text-center">
          Draw
        </div>
        <div className="text-red-500 truncate w-1/3 text-right">
          {awayTeamName}
        </div>
      </div>
    </div>
  )
}

