'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PassingNetwork } from './PassingNetwork'
import { PlayerHeatmap } from './PlayerHeatmap'
import { PPDAMeter } from './PPDAMeter'
import { BuildUpInsights } from './BuildUpInsights'
import { PageSpinner } from '@/components/ui/Spinner'
import type { MatchTacticsResponse } from '@/lib/tactics-generator'

interface TacticalInsightsProps {
  matchId: string | number
  homeTeam: { id: number; name: string; shortName: string; crest?: string }
  awayTeam: { id: number; name: string; shortName: string; crest?: string }
}

export function TacticalInsights({ matchId, homeTeam, awayTeam }: TacticalInsightsProps) {
  const [activeTab, setActiveTab] = useState<'passing' | 'heatmap' | 'ppda' | 'buildup'>('passing')
  const [activeTeamSide, setActiveTeamSide] = useState<'home' | 'away'>('home')

  const { data: tactics, isLoading, isError } = useQuery<MatchTacticsResponse>({
    queryKey: ['tactics', matchId],
    queryFn: async () => {
      const res = await fetch(`/api/matches/${matchId}/tactics`)
      if (!res.ok) throw new Error('Failed to fetch tactical data')
      return res.json()
    },
    staleTime: 60 * 1000,
  })

  if (isLoading) {
    return (
      <div className="bg-card p-10 rounded-2xl border text-center flex flex-col items-center justify-center space-y-3">
        <PageSpinner />
        <p className="text-sm text-muted-foreground font-medium">Generating tactical models & pass networks...</p>
      </div>
    )
  }

  if (isError || !tactics) {
    return (
      <div className="bg-card p-6 rounded-2xl border text-center text-muted-foreground">
        Tactical insights data unavailable for this match.
      </div>
    )
  }

  const selectedTeamTactics = activeTeamSide === 'home' ? tactics.homeTeam : tactics.awayTeam

  return (
    <div className="bg-card rounded-2xl border p-6 space-y-6 shadow-sm">
      {/* Module Title & Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-6 bg-primary rounded-full" />
            <h3 className="text-xl font-bold tracking-tight">Tactical Insights</h3>
            <span className="text-[10px] uppercase font-black bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">
              Opta Style
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Passing network topology, spatial heat density & pressing intensity metrics
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl border">
          <button
            onClick={() => setActiveTab('passing')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'passing'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            🕸️ Passing Network
          </button>
          <button
            onClick={() => setActiveTab('heatmap')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'heatmap'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            🌡️ Heatmaps
          </button>
          <button
            onClick={() => setActiveTab('ppda')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'ppda'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            ⚡ Pressing & PPDA
          </button>
          <button
            onClick={() => setActiveTab('buildup')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'buildup'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            🏗️ Build-Up
          </button>
        </div>
      </div>

      {/* Team Toggle for Passing and Heatmap Tabs */}
      {(activeTab === 'passing' || activeTab === 'heatmap') && (
        <div className="flex items-center justify-center">
          <div className="inline-flex items-center p-1 bg-muted rounded-xl border gap-1">
            <button
              onClick={() => setActiveTeamSide('home')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTeamSide === 'home'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {homeTeam.crest && (
                <img src={homeTeam.crest} alt={homeTeam.name} className="w-4 h-4 object-contain" />
              )}
              <span>{homeTeam.shortName || homeTeam.name}</span>
              <span className="text-[10px] opacity-80">({tactics.homeTeam.formation})</span>
            </button>

            <button
              onClick={() => setActiveTeamSide('away')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTeamSide === 'away'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {awayTeam.crest && (
                <img src={awayTeam.crest} alt={awayTeam.name} className="w-4 h-4 object-contain" />
              )}
              <span>{awayTeam.shortName || awayTeam.name}</span>
              <span className="text-[10px] opacity-80">({tactics.awayTeam.formation})</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab Panels */}
      {activeTab === 'passing' && (
        <PassingNetwork
          nodes={selectedTeamTactics.passingNetwork.nodes}
          links={selectedTeamTactics.passingNetwork.links}
          topCombinations={selectedTeamTactics.passingNetwork.topCombinations}
          centralPlayer={selectedTeamTactics.passingNetwork.centralPlayer}
          teamName={selectedTeamTactics.name}
          teamCrest={selectedTeamTactics.crest}
        />
      )}

      {activeTab === 'heatmap' && (
        <PlayerHeatmap
          teamPoints={selectedTeamTactics.heatmaps.teamPoints}
          playersData={selectedTeamTactics.heatmaps.players}
          playersList={selectedTeamTactics.passingNetwork.nodes.map((n) => ({
            id: n.id,
            name: n.name,
            shirtNumber: n.shirtNumber,
            position: n.position,
          }))}
          teamName={selectedTeamTactics.name}
        />
      )}

      {activeTab === 'ppda' && (
        <PPDAMeter
          homeTeam={tactics.homeTeam}
          awayTeam={tactics.awayTeam}
          summary={tactics.summary}
        />
      )}

      {activeTab === 'buildup' && (
        <BuildUpInsights
          homeTeam={tactics.homeTeam}
          awayTeam={tactics.awayTeam}
        />
      )}
    </div>
  )
}
