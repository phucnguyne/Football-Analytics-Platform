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
    <Link href={`/matches/${match.id}`}>
      <div className={`card p-4 hover:shadow-md transition-all duration-200 cursor-pointer ${isLive ? 'ring-1 ring-red-300' : ''}`}>
        {/* Top row: status + date */}
        <div className="flex items-center justify-between mb-3 text-xs text-muted-foreground">
          <StatusBadge status={match.status} />
          <span>{formatDate(match.utcDate)} {formatTime(match.utcDate)}</span>
        </div>

        {/* Score row */}
        <div className="flex items-center justify-between gap-4">
          {/* Home */}
          <div className="flex-1 flex items-center gap-3 min-w-0">
            {home.crest && (
              <Image src={home.crest} alt={home.name} width={32} height={32} className="object-contain flex-shrink-0" />
            )}
            <span className="font-semibold truncate">{home.shortName || home.name}</span>
          </div>

          {/* Score / time */}
          <div className="flex-shrink-0 text-center">
            {score ? (
              <span className="score-box">
                {score.homeTeamGoals} – {score.awayTeamGoals}
              </span>
            ) : (
              <span className="text-sm font-medium text-muted-foreground">vs</span>
            )}
          </div>

          {/* Away */}
          <div className="flex-1 flex items-center justify-end gap-3 min-w-0">
            <span className="font-semibold truncate text-right">{away.shortName || away.name}</span>
            {away.crest && (
              <Image src={away.crest} alt={away.name} width={32} height={32} className="object-contain flex-shrink-0" />
            )}
          </div>
        </div>

        {/* HT score */}
        {score?.homeTeamGoalsHT !== undefined && (
          <p className="text-center text-xs text-muted-foreground mt-2">
            HT {score.homeTeamGoalsHT} – {score.awayTeamGoalsHT}
          </p>
        )}
      </div>
    </Link>
  )
}
