'use client'
import Link from 'next/link'
import Image from 'next/image'
import { StatusBadge } from '@/components/ui/Badge'
import { formatTime, formatDate } from '@/lib/utils'
import type { Match } from '@/types/TypesBarrel'

interface MatchCardProps { match: Match }

export function MatchCard({ match }: MatchCardProps) {
  const home  = match.homeTeam
  const away  = match.awayTeam
  const score = match.score
  const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED'

  return (
    <div className={`group p-4 rounded-xl bg-card border-3 border-border/50 hover:border-primary/50 transition-all duration-300 ${isLive ? 'ring-1 ring-red-500/50' : ''}`}>
      {/* Top row: status + date */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <StatusBadge status={match.status} />
          {match.competition && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wider">{match.competition.name}</span>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground text-right leading-tight">
          <p>{formatDate(match.utcDate)}</p>
          <p>{formatTime(match.utcDate)}</p>
        </div>
      </div>

      {/* Score row */}
      <div className="flex items-center justify-between gap-2">
        {/* Home */}
        <Link href={`/teams/${home.id}`} className="flex-1 flex items-center gap-2 min-w-0 hover:text-primary transition-colors cursor-pointer" title={home.name}>
          {home.crest && (
            <Image src={home.crest} alt={home.name} width={28} height={28} className="object-contain flex-shrink-0" />
          )}
          <span className="font-bold text-sm truncate">{home.shortName || home.name}</span>
        </Link>

        {/* Center column: Score, Details, HT */}
        <div className="flex-shrink-0 w-20 flex flex-col items-center">
          <Link href={`/matches/${match.id}`} className="flex flex-col items-center hover:text-primary transition-colors group/link">
            {score ? (
              <span className="text-lg font-black tracking-tight mb-1">
                {score.homeTeamGoals} - {score.awayTeamGoals}
              </span>
            ) : (
              <span className="text-sm font-medium text-muted-foreground mb-1">vs</span>
            )}
            <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold group-hover/link:text-primary transition-colors">Details</span>
          </Link>
          {score?.homeTeamGoalsHT !== undefined && score.homeTeamGoalsHT !== null && (
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">
              HT {score.homeTeamGoalsHT} - {score.awayTeamGoalsHT}
            </p>
          )}
        </div>

        {/* Away */}
        <Link href={`/teams/${away.id}`} className="flex-1 flex items-center justify-end gap-2 min-w-0 hover:text-primary transition-colors cursor-pointer" title={away.name}>
          <span className="font-bold text-sm truncate text-right">{away.shortName || away.name}</span>
          {away.crest && (
            <Image src={away.crest} alt={away.name} width={28} height={28} className="object-contain flex-shrink-0" />
          )}
        </Link>
      </div>

      {/* Mini Prediction Bar for upcoming matches */}
      {(match as any).prediction && (match.status === 'SCHEDULED' || match.status === 'TIMED') && (
        <div className="mt-3 pt-3 border-t border-border/30">
          <div className="flex h-1.5 rounded-full overflow-hidden">
            <div style={{ width: `${((match as any).prediction.homeWin * 100).toFixed(0)}%` }} className="bg-blue-500" title={`${home.shortName}: ${((match as any).prediction.homeWin * 100).toFixed(0)}%`}></div>
            <div style={{ width: `${((match as any).prediction.draw * 100).toFixed(0)}%` }} className="bg-neutral-400" title={`Draw: ${((match as any).prediction.draw * 100).toFixed(0)}%`}></div>
            <div style={{ width: `${((match as any).prediction.awayWin * 100).toFixed(0)}%` }} className="bg-red-500" title={`${away.shortName}: ${((match as any).prediction.awayWin * 100).toFixed(0)}%`}></div>
          </div>
          <div className="flex justify-between text-[9px] text-muted-foreground mt-1 font-medium tabular-nums">
            <span>{((match as any).prediction.homeWin * 100).toFixed(0)}%</span>
            <span>{((match as any).prediction.draw * 100).toFixed(0)}%</span>
            <span>{((match as any).prediction.awayWin * 100).toFixed(0)}%</span>
          </div>
        </div>
      )}
    </div>
  )
}
