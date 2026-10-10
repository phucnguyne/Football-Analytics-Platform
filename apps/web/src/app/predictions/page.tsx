'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Container } from '@/components/ui/grid'
import { useQuery } from '@tanstack/react-query'
import { PageSpinner } from '@/components/ui/Spinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'

interface TeamPrediction {
  teamId: number
  name: string
  shortName: string
  crest: string | null
  currentPoints: number
  currentPlayed: number
  currentGD: number
  avgPoints: number
  medianPoints: number
  minPoints: number
  maxPoints: number
  titleProb: number
  topFourProb: number
  relegationProb: number
}

interface SeasonPrediction {
  simulations: number
  matchesPlayed: number
  matchesRemaining: number
  leagueAvgHomeGoals: number
  leagueAvgAwayGoals: number
  teams: TeamPrediction[]
}

async function fetchSeasonPrediction(): Promise<SeasonPrediction> {
  const res = await fetch('/api/predictions/season')
  if (!res.ok) throw new Error('Failed to fetch predictions')
  return res.json()
}

function ProbBar({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-2.5 rounded-full transition-all duration-1000 ${color}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        ></div>
      </div>
      <span className="text-xs font-mono font-semibold w-14 text-right whitespace-nowrap">{value}%</span>
    </div>
  )
}

export default function PredictionsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['season-prediction'],
    queryFn: fetchSeasonPrediction,
    staleTime: 1000 * 60 * 10, // cache 10 min
  })

  if (isLoading) return <PageSpinner />
  if (isError || !data) return <ErrorMessage />

  return (
    <Container className="py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <span className="text-4xl">🔮</span> Season Predictions
        </h1>
        <p className="text-muted-foreground">
          Monte Carlo simulation ({data.simulations.toLocaleString()} iterations) using Poisson distribution.
          Based on {data.matchesPlayed} matches played, {data.matchesRemaining} remaining.
        </p>
      </div>

      {/* Model Info */}
      <div className="bg-card p-5 rounded-2xl border mb-8 flex flex-wrap gap-6 text-sm">
        <div>
          <span className="text-muted-foreground">Simulations:</span>{' '}
          <span className="font-bold">{data.simulations.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Avg Home Goals/Match:</span>{' '}
          <span className="font-bold">{data.leagueAvgHomeGoals}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Avg Away Goals/Match:</span>{' '}
          <span className="font-bold">{data.leagueAvgAwayGoals}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Model:</span>{' '}
          <span className="font-bold">Poisson + Team Strength</span>
        </div>
      </div>

      {/* Predicted Standings Table */}
      <div className="bg-card rounded-2xl border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground uppercase text-xs tracking-wider">
                <th className="text-left p-4 w-8">#</th>
                <th className="text-left p-4">Team</th>
                <th className="text-center p-4" title="Matches Played">P</th>
                <th className="text-center p-4" title="Current Points">Pts</th>
                <th className="text-center p-4" title="Goal Difference">GD</th>
                <th className="text-center p-4 hidden md:table-cell" title="Predicted Avg Points">Pred Pts</th>
                <th className="text-center p-4 hidden lg:table-cell" title="Points Range (Min-Max)">Range</th>
                <th className="p-4 w-36" title="Title Probability">
                  <div className="flex items-center gap-1">🏆 Title</div>
                </th>
                <th className="p-4 w-36" title="Top 4 (Champions League) Probability">
                  <div className="flex items-center gap-1">⭐ Top 4</div>
                </th>
                <th className="p-4 w-36" title="Relegation Probability">
                  <div className="flex items-center gap-1">⬇️ Releg.</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.teams.map((team, i) => (
                <tr key={team.teamId} className={`hover:bg-muted/30 transition-colors ${
                  i < 1 ? 'bg-yellow-500/5' : i < 4 ? 'bg-blue-500/5' : i >= data.teams.length - 3 ? 'bg-red-500/5' : ''
                }`}>
                  <td className="p-4 font-bold text-muted-foreground">{i + 1}</td>
                  <td className="p-4">
                    <Link href={`/teams/${team.teamId}`} className="flex items-center gap-3 hover:text-primary transition-colors">
                      {team.crest && <Image src={team.crest} alt={team.name} width={24} height={24} className="object-contain" />}
                      <span className="font-semibold hidden md:inline">{team.name}</span>
                      <span className="font-semibold md:hidden">{team.shortName}</span>
                    </Link>
                  </td>
                  <td className="p-4 text-center tabular-nums">{team.currentPlayed}</td>
                  <td className="p-4 text-center font-bold tabular-nums">{team.currentPoints}</td>
                  <td className="p-4 text-center tabular-nums">
                    <span className={team.currentGD > 0 ? 'text-green-500' : team.currentGD < 0 ? 'text-red-500' : ''}>
                      {team.currentGD > 0 ? '+' : ''}{team.currentGD}
                    </span>
                  </td>
                  <td className="p-4 text-center font-bold tabular-nums hidden md:table-cell text-primary">{team.avgPoints}</td>
                  <td className="p-4 text-center tabular-nums text-xs text-muted-foreground hidden lg:table-cell">
                    {team.minPoints}–{team.maxPoints}
                  </td>
                  <td className="p-4">
                    <ProbBar value={team.titleProb} color="bg-yellow-500" label="Title" />
                  </td>
                  <td className="p-4">
                    <ProbBar value={team.topFourProb} color="bg-blue-500" label="Top 4" />
                  </td>
                  <td className="p-4">
                    <ProbBar value={team.relegationProb} color="bg-red-500" label="Relegation" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center mt-6">
        Predictions are generated using a Dixon-Coles inspired Poisson model. Team attack and defense strengths
        are calculated from this season's results. Each simulation randomly generates scores for all remaining
        matches and ranks teams by points then goal difference.
      </p>
    </Container>
  )
}

