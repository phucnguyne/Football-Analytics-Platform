'use client'
import { use } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Container } from '@/components/ui/grid'
import { useQuery } from '@tanstack/react-query'
import { getMatch } from '@/lib/api'
import { PageSpinner } from '@/components/ui/Spinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { StatusBadge } from '@/components/ui/Badge'
import { formatDate, formatTime } from '@/lib/utils'

export default function MatchDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const { data: match, isLoading, isError } = useQuery({
    queryKey: ['match', id],
    queryFn: () => getMatch(id),
    enabled: !!id
  })

  if (isLoading) return <PageSpinner />
  if (isError || !match) return <ErrorMessage />

  // football-data.org raw shape:
  //   homeTeam: { id, name, shortName, crest, lineup: [{ id, name, position, shirtNumber }], ... }
  //   awayTeam: same
  //   goals: [{ minute, injuryTime, team: { id, name }, scorer: { id, name }, assist: { id, name }, type }]
  //   bookings: [{ minute, team, player: { id, name }, card: "YELLOW_CARD" | "RED_CARD" }]
  //   substitutions: [{ minute, team, playerOut: { id, name }, playerIn: { id, name } }]
  //   referees: [{ id, name, type, nationality }]
  //   score: { winner, duration, fullTime: { home, away }, halfTime: { home, away } }

  const homeLineup = match.homeTeam?.lineup ?? []
  const awayLineup = match.awayTeam?.lineup ?? []
  const goals = (match.goals ?? []).map((g: any) => ({ ...g, eventType: 'goal' }))
  const bookings = (match.bookings ?? []).map((b: any) => ({ ...b, eventType: 'booking' }))
  const substitutions = (match.substitutions ?? []).map((s: any) => ({ ...s, eventType: 'sub' }))

  const allEvents = [...goals, ...bookings, ...substitutions]
    .sort((a: any, b: any) => (a.minute ?? 0) - (b.minute ?? 0))

  const referee = match.referees?.find((r: any) => r.type === 'REFEREE')

  return (
    <Container className="py-10">
      {/* Back link */}
      <Link href="/matches" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-6">
        ← Back to Matches
      </Link>

      {/* Match Header */}
      <div className="bg-card p-8 rounded-2xl border mb-8 flex flex-col items-center shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
        
        <div className="flex flex-col items-center mb-6 z-10">
          {match.competition && (
            <span className="text-sm font-semibold text-primary uppercase tracking-widest mb-2">{match.competition.name}</span>
          )}
          <div className="flex items-center gap-3 text-muted-foreground text-sm">
            <StatusBadge status={match.status} />
            {match.matchday && <span>Matchday {match.matchday}</span>}
            <span>{formatDate(match.utcDate)}</span>
            <span>{formatTime(match.utcDate)}</span>
          </div>
          {match.venue && (
            <p className="text-xs text-muted-foreground mt-2">📍 {match.venue}</p>
          )}
          {referee && (
            <p className="text-xs text-muted-foreground mt-1">🏁 Referee: {referee.name} ({referee.nationality})</p>
          )}
        </div>

        <div className="flex items-center justify-between w-full max-w-3xl z-10">
          {/* Home Team */}
          <Link href={`/teams/${match.homeTeam.id}`} className="flex-1 flex flex-col items-center gap-4 hover:scale-105 transition-transform">
            {match.homeTeam.crest && <Image src={match.homeTeam.crest} alt={match.homeTeam.name} width={80} height={80} className="object-contain" />}
            <span className="text-xl font-bold text-center">{match.homeTeam.name}</span>
          </Link>

          {/* Score */}
          <div className="flex-shrink-0 px-8 flex flex-col items-center">
            {match.score?.fullTime?.home !== null && match.score?.fullTime?.home !== undefined ? (
              <div className="text-5xl font-black tracking-tighter tabular-nums">
                {match.score.fullTime.home} – {match.score.fullTime.away}
              </div>
            ) : (
              <div className="text-3xl font-bold text-muted-foreground">VS</div>
            )}
            {match.score?.halfTime?.home !== null && match.score?.halfTime?.home !== undefined && (
              <div className="text-sm text-muted-foreground mt-2">
                HT: {match.score.halfTime.home} – {match.score.halfTime.away}
              </div>
            )}
          </div>

          {/* Away Team */}
          <Link href={`/teams/${match.awayTeam.id}`} className="flex-1 flex flex-col items-center gap-4 hover:scale-105 transition-transform">
            {match.awayTeam.crest && <Image src={match.awayTeam.crest} alt={match.awayTeam.name} width={80} height={80} className="object-contain" />}
            <span className="text-xl font-bold text-center">{match.awayTeam.name}</span>
          </Link>
        </div>
      </div>

      {/* Goal Scorers Summary */}
      {goals.length > 0 && (
        <div className="bg-card p-6 rounded-2xl border mb-8">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="text-xl">⚽</span> Goal Scorers
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            {/* Home goals */}
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 font-semibold">{match.homeTeam.shortName || match.homeTeam.name}</p>
              <ul className="space-y-1">
                {goals.filter((g: any) => g.team?.id === match.homeTeam.id).map((g: any, i: number) => (
                  <li key={i} className="text-sm flex items-center gap-2">
                    <span className="font-bold">{g.scorer?.name}</span>
                    <span className="text-muted-foreground">{g.minute}'{g.injuryTime ? `+${g.injuryTime}` : ''}</span>
                    {g.type === 'PENALTY' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-600 font-bold uppercase">Pen</span>}
                    {g.type === 'OWN_GOAL' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-600 font-bold uppercase">OG</span>}
                    {g.assist?.name && <span className="text-xs text-muted-foreground">(assist: {g.assist.name})</span>}
                  </li>
                ))}
                {goals.filter((g: any) => g.team?.id === match.homeTeam.id).length === 0 && (
                  <li className="text-sm text-muted-foreground">—</li>
                )}
              </ul>
            </div>
            {/* Away goals */}
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 font-semibold">{match.awayTeam.shortName || match.awayTeam.name}</p>
              <ul className="space-y-1">
                {goals.filter((g: any) => g.team?.id === match.awayTeam.id).map((g: any, i: number) => (
                  <li key={i} className="text-sm flex items-center gap-2">
                    <span className="font-bold">{g.scorer?.name}</span>
                    <span className="text-muted-foreground">{g.minute}'{g.injuryTime ? `+${g.injuryTime}` : ''}</span>
                    {g.type === 'PENALTY' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-600 font-bold uppercase">Pen</span>}
                    {g.type === 'OWN_GOAL' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-600 font-bold uppercase">OG</span>}
                    {g.assist?.name && <span className="text-xs text-muted-foreground">(assist: {g.assist.name})</span>}
                  </li>
                ))}
                {goals.filter((g: any) => g.team?.id === match.awayTeam.id).length === 0 && (
                  <li className="text-sm text-muted-foreground">—</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-8">
        {/* Events Timeline */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-card p-6 rounded-2xl border">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <span className="w-2 h-6 bg-primary rounded-full" />
              Match Events
            </h3>
            
            {allEvents.length > 0 ? (
              <div className="space-y-3">
                {allEvents.map((ev: any, i: number) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50">
                    <div className="w-12 h-8 flex items-center justify-center rounded-lg bg-muted font-bold text-xs tabular-nums flex-shrink-0">
                      {ev.minute}'{ev.injuryTime ? `+${ev.injuryTime}` : ''}
                    </div>

                    <div className="flex-1 text-sm">
                      {ev.eventType === 'goal' && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-lg">⚽</span>
                          <span className="font-bold">{ev.scorer?.name}</span>
                          {ev.assist?.name && <span className="text-muted-foreground text-xs">(assist: {ev.assist.name})</span>}
                          {ev.type === 'PENALTY' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-600 font-bold uppercase">Pen</span>}
                          {ev.type === 'OWN_GOAL' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-600 font-bold uppercase">OG</span>}
                        </div>
                      )}
                      {ev.eventType === 'booking' && (
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{ev.card === 'YELLOW_CARD' ? '🟨' : '🟥'}</span>
                          <span className="font-medium">{ev.player?.name}</span>
                          <span className="text-xs text-muted-foreground">{ev.card === 'YELLOW_CARD' ? 'Yellow Card' : 'Red Card'}</span>
                        </div>
                      )}
                      {ev.eventType === 'sub' && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-lg">🔄</span>
                          <span className="text-green-500 font-medium">▲ {ev.playerIn?.name}</span>
                          <span className="text-red-400 font-medium">▼ {ev.playerOut?.name}</span>
                        </div>
                      )}
                    </div>

                    {ev.team && (
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold flex-shrink-0">
                        {ev.team.name}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                {match.status === 'FINISHED' ? 'No detailed events available for this match (free tier API limitation).' : 'Match events will appear once the match is played.'}
              </p>
            )}
          </div>
        </div>

        {/* Lineups */}
        <div className="space-y-6">
          <div className="bg-card p-6 rounded-2xl border">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <span className="w-2 h-6 bg-primary rounded-full" />
              Line-ups
            </h3>
            
            {homeLineup.length > 0 || awayLineup.length > 0 ? (
              <>
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3 border-b pb-2">
                    {match.homeTeam.crest && <Image src={match.homeTeam.crest} alt="Home" width={24} height={24} />}
                    <span className="font-bold">{match.homeTeam.shortName || match.homeTeam.name}</span>
                    {match.homeTeam.formation && <span className="ml-auto text-xs text-muted-foreground">({match.homeTeam.formation})</span>}
                  </div>
                  <ul className="space-y-1.5">
                    {homeLineup.map((p: any) => (
                      <li key={p.id} className="text-sm flex justify-between items-center py-1 px-2 rounded hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-2">
                          {p.shirtNumber && <span className="w-6 text-center text-xs text-muted-foreground font-bold">{p.shirtNumber}</span>}
                          <span>{p.name}</span>
                        </div>
                        <span className="text-muted-foreground text-[10px] uppercase tracking-wider font-semibold">{p.position?.replace('_', ' ')}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-3 border-b pb-2">
                    {match.awayTeam.crest && <Image src={match.awayTeam.crest} alt="Away" width={24} height={24} />}
                    <span className="font-bold">{match.awayTeam.shortName || match.awayTeam.name}</span>
                    {match.awayTeam.formation && <span className="ml-auto text-xs text-muted-foreground">({match.awayTeam.formation})</span>}
                  </div>
                  <ul className="space-y-1.5">
                    {awayLineup.map((p: any) => (
                      <li key={p.id} className="text-sm flex justify-between items-center py-1 px-2 rounded hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-2">
                          {p.shirtNumber && <span className="w-6 text-center text-xs text-muted-foreground font-bold">{p.shirtNumber}</span>}
                          <span>{p.name}</span>
                        </div>
                        <span className="text-muted-foreground text-[10px] uppercase tracking-wider font-semibold">{p.position?.replace('_', ' ')}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                {match.status === 'FINISHED' ? 'Line-ups not available (free tier API limitation).' : 'Line-ups will be published before kick-off.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </Container>
  )
}
