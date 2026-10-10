'use client'

import { use } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Container } from '@/components/ui/grid'
import { PageSpinner } from '@/components/ui/Spinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { PlayerRadarChart } from '@/components/players/PlayerRadarChart'

async function getPlayer(id: string) {
  const res = await fetch(`/api/persons/${id}`)
  if (!res.ok) throw new Error('Failed to fetch player')
  return res.json()
}

export default function PlayerDetailsPage({ params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = use(params)

  const { data: player, isLoading, isError } = useQuery({
    queryKey: ['player', playerId],
    queryFn: () => getPlayer(playerId),
    enabled: !!playerId
  })

  if (isLoading) return <PageSpinner />
  if (isError || !player) return <ErrorMessage />

  const stats = player.stats
  const currentTeam = player.teams?.[0]

  return (
    <Container className="py-10">
      <Link href="/teams" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-6">
        ← Back to Teams
      </Link>

      <div className="grid lg:grid-cols-3 gap-8">
        
        {/* Left Col: Player Profile Card */}
        <div className="space-y-6">
          <div className="bg-card p-6 rounded-2xl border shadow-sm relative overflow-hidden flex flex-col items-center text-center">
            <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />
            
            {player.photo ? (
              <Image src={player.photo} alt={player.name} width={120} height={120} className="rounded-full border-4 border-background shadow-md relative z-10 mb-4" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center text-4xl mb-4 relative z-10 shadow-md">
                👤
              </div>
            )}
            
            <h1 className="text-3xl font-bold tracking-tight mb-1">{player.name}</h1>
            <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium mb-4 uppercase tracking-wider">
              {player.position?.replace('_', ' ')}
            </div>

            {currentTeam && (
              <Link href={`/teams/${currentTeam.id}`} className="flex items-center gap-2 hover:bg-muted/50 p-2 rounded-lg transition-colors border">
                {currentTeam.crest && <Image src={currentTeam.crest} alt={currentTeam.name} width={24} height={24} />}
                <span className="font-semibold text-sm">{currentTeam.name}</span>
                {player.shirtNumber && <span className="text-muted-foreground border-l pl-2 text-xs">#{player.shirtNumber}</span>}
              </Link>
            )}

            <div className="w-full grid grid-cols-2 gap-4 mt-6 text-sm">
              <div className="bg-muted/30 p-3 rounded-xl border border-transparent">
                <p className="text-muted-foreground text-xs uppercase mb-1">Nationality</p>
                <p className="font-semibold">{player.nationality || 'Unknown'}</p>
              </div>
              <div className="bg-muted/30 p-3 rounded-xl border border-transparent">
                <p className="text-muted-foreground text-xs uppercase mb-1">Age</p>
                <p className="font-semibold">
                  {player.dateOfBirth ? (
                    `${new Date().getFullYear() - new Date(player.dateOfBirth).getFullYear()} yrs`
                  ) : 'Unknown'}
                </p>
              </div>
            </div>
          </div>

          {/* Basic Stats Summary */}
          {stats && (
            <div className="bg-card p-6 rounded-2xl border">
              <h3 className="text-lg font-bold mb-4">Season Summary</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-muted/20 rounded-xl">
                  <p className="text-3xl font-black tabular-nums text-primary mb-1">{stats.matchesPlayed}</p>
                  <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">Matches</p>
                </div>
                <div className="text-center p-4 bg-muted/20 rounded-xl">
                  <p className="text-3xl font-black tabular-nums text-primary mb-1">{stats.goals}</p>
                  <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">Goals</p>
                </div>
                <div className="text-center p-4 bg-muted/20 rounded-xl">
                  <p className="text-3xl font-black tabular-nums text-primary mb-1">{stats.assists}</p>
                  <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">Assists</p>
                </div>
                <div className="text-center p-4 bg-muted/20 rounded-xl">
                  <p className="text-3xl font-black tabular-nums text-primary mb-1">{stats.minutesPlayed}'</p>
                  <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">Minutes</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Col: Advanced Stats Radar & Details */}
        <div className="lg:col-span-2 space-y-6">
          <PlayerRadarChart 
            playerStats={stats} 
            positionalAverages={player.positionalAverages} 
            playerName={player.name}
            position={player.position?.replace('_', ' ') || 'Unknown'} 
          />

          {stats && (
            <div className="bg-card p-6 rounded-2xl border">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <span className="text-xl">📊</span> Detailed Metrics
              </h3>
              
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 border-b pb-2">Attacking</h4>
                  <ul className="space-y-3">
                    <li className="flex justify-between items-center text-sm">
                      <span>Expected Goals (xG)</span>
                      <span className="font-bold tabular-nums">{stats.xG?.toFixed(2) || '0.00'}</span>
                    </li>
                    <li className="flex justify-between items-center text-sm">
                      <span>Expected Assists (xA)</span>
                      <span className="font-bold tabular-nums">{stats.xA?.toFixed(2) || '0.00'}</span>
                    </li>
                    <li className="flex justify-between items-center text-sm">
                      <span>Shots / 90</span>
                      <span className="font-bold tabular-nums">{stats.shotsPer90?.toFixed(2) || '0.00'}</span>
                    </li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 border-b pb-2">Possession</h4>
                  <ul className="space-y-3">
                    <li className="flex justify-between items-center text-sm">
                      <span>Pass Completion</span>
                      <span className="font-bold tabular-nums">{stats.passCompletion?.toFixed(1) || '0.0'}%</span>
                    </li>
                    <li className="flex justify-between items-center text-sm">
                      <span>Prog. Passes</span>
                      <span className="font-bold tabular-nums">{stats.progressivePasses?.toFixed(1) || '0.0'}</span>
                    </li>
                    <li className="flex justify-between items-center text-sm">
                      <span>Successful Dribbles</span>
                      <span className="font-bold tabular-nums">{stats.dribblesSuccess?.toFixed(1) || '0.0'}%</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 border-b pb-2">Defending</h4>
                  <ul className="space-y-3">
                    <li className="flex justify-between items-center text-sm">
                      <span>Tackles / 90</span>
                      <span className="font-bold tabular-nums">{stats.tacklesPer90?.toFixed(2) || '0.00'}</span>
                    </li>
                    <li className="flex justify-between items-center text-sm">
                      <span>Interceptions</span>
                      <span className="font-bold tabular-nums">{stats.interceptions?.toFixed(2) || '0.00'}</span>
                    </li>
                    <li className="flex justify-between items-center text-sm text-red-500">
                      <span>Cards (Y/R)</span>
                      <span className="font-bold tabular-nums">{stats.yellowCards} / {stats.redCards}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </Container>
  )
}

