'use client'

import React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { PageSpinner } from '@/components/ui/Spinner'
import type { SimilarPlayerResult } from '@/lib/player-analytics'

interface SimilarPlayersCardProps {
  playerId: number
  playerName: string
  onSelectForCompare?: (player: SimilarPlayerResult) => void
}

export function SimilarPlayersCard({
  playerId,
  playerName,
  onSelectForCompare,
}: SimilarPlayersCardProps) {
  const { data, isLoading, isError } = useQuery<{
    similarPlayers: SimilarPlayerResult[]
  }>({
    queryKey: ['similar-players', playerId],
    queryFn: async () => {
      const res = await fetch(`/api/persons/${playerId}/similar`)
      if (!res.ok) throw new Error('Failed to fetch similar players')
      return res.json()
    },
    staleTime: 60 * 1000,
  })

  if (isLoading) {
    return (
      <div className="bg-card p-8 rounded-2xl border flex flex-col items-center justify-center">
        <PageSpinner />
        <p className="text-xs text-muted-foreground mt-2">Computing statistical similarity matrix...</p>
      </div>
    )
  }

  if (isError || !data || data.similarPlayers.length === 0) {
    return (
      <div className="bg-card p-6 rounded-2xl border text-center text-muted-foreground text-sm">
        No similar players identified.
      </div>
    )
  }

  const { similarPlayers } = data

  return (
    <div className="bg-card p-6 rounded-2xl border space-y-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-6 bg-purple-500 rounded-full" />
            <h3 className="text-lg font-bold">Similar Players (Scouting Radar)</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Players with closest multidimensional performance profiles across the league
          </p>
        </div>

        <span className="text-[10px] font-mono uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2.5 py-1 rounded-full font-bold">
          Cosine Similarity
        </span>
      </div>

      <div className="space-y-3">
        {similarPlayers.map((player) => (
          <div
            key={player.id}
            className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-muted/30 hover:bg-muted/60 border border-transparent hover:border-border transition-all"
          >
            {/* Player Info */}
            <div className="flex items-center gap-3 min-w-[200px]">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold text-sm overflow-hidden border">
                {player.team.crest ? (
                  <img src={player.team.crest} alt={player.team.name} className="w-7 h-7 object-contain" />
                ) : (
                  <span>👤</span>
                )}
              </div>

              <div>
                <Link
                  href={`/players/${player.id}`}
                  className="font-bold text-sm text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5"
                >
                  <span>{player.name}</span>
                </Link>
                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                  <span>{player.team.shortName}</span>
                  <span>•</span>
                  <span>{player.position?.replace('_', ' ')}</span>
                  {player.shirtNumber && <span>#{player.shirtNumber}</span>}
                </div>
              </div>
            </div>

            {/* Tactical Style Tags */}
            <div className="flex flex-wrap items-center gap-1.5 flex-1 max-w-sm">
              {player.styleTags.map((tag, i) => (
                <span
                  key={i}
                  className="text-[10px] font-semibold bg-background/80 px-2 py-0.5 rounded-md border text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Similarity Score & Action */}
            <div className="flex items-center gap-4 justify-between sm:justify-end">
              <div className="text-right">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-purple-400 tabular-nums">
                    {player.similarityScore}%
                  </span>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Match</span>
                </div>
                <div className="h-1.5 w-20 bg-muted rounded-full overflow-hidden mt-1">
                  <div
                    style={{ width: `${player.similarityScore}%` }}
                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
                  />
                </div>
              </div>

              {onSelectForCompare ? (
                <button
                  onClick={() => onSelectForCompare(player)}
                  className="px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground font-bold text-xs transition-colors border border-primary/20"
                >
                  Compare
                </button>
              ) : (
                <Link
                  href={`/players/compare?p1=${playerId}&p2=${player.id}`}
                  className="px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground font-bold text-xs transition-colors border border-primary/20"
                >
                  Compare
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

