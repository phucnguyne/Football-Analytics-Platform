'use client'

import { useMatchLive } from '@/hooks/useMatchLive'
import Link from 'next/link'
import Image from 'next/image'

export function LiveScoreboard() {
  const { liveMatchesArray, isConnected, isInitializing } = useMatchLive()
  const activeMatches = liveMatchesArray
    .filter((match) => ['IN_PLAY', 'PAUSED', 'LIVE'].includes(match.status))
    .sort((a, b) => a.homeTeamName.localeCompare(b.homeTeamName))

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Live Match Center</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time scores and match status across tracked competitions.
          </p>
        </div>

        <span className={`inline-flex items-center gap-2 text-sm font-semibold ${isConnected ? 'text-green-600' : 'text-muted-foreground'}`}>
          <span className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'animate-pulse bg-red-500' : 'bg-muted-foreground'}`} />
          {isConnected ? 'Live feed connected' : 'Connecting to live feed'}
        </span>
      </div>

      {isInitializing ? (
        <div className="rounded-2xl border bg-card p-10 text-center text-muted-foreground">
          Loading live matches...
        </div>
      ) : activeMatches.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <p className="text-lg font-semibold">No matches are live right now</p>
          <p className="mt-2 text-sm text-muted-foreground">
            This page updates automatically when a tracked match starts.
          </p>
          <Link href="/matches" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">
            View the match schedule
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {activeMatches.map((match) => (
            <Link
              key={match.matchId}
              href={`/matches/${match.matchId}`}
              className="rounded-2xl border bg-card p-5 transition-colors hover:border-primary/50"
            >
              <div className="mb-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span className="truncate">{match.competition || 'Live match'}</span>
                <span className="shrink-0 rounded-full bg-red-500/10 px-2.5 py-1 font-bold text-red-600">
                  {match.status === 'PAUSED'
                    ? 'HALF-TIME'
                    : match.minute != null
                      ? `${match.minute}'`
                      : 'LIVE'}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {match.homeTeamCrest ? (
                    <Image src={match.homeTeamCrest} alt="" width={32} height={32} className="h-8 w-8 object-contain" unoptimized />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold">
                      {match.homeTeamShortName.slice(0, 2)}
                    </span>
                  )}
                  <span className="truncate text-sm font-semibold">{match.homeTeamName}</span>
                </div>

                <span className="shrink-0 rounded-lg bg-muted px-3 py-2 text-lg font-black tabular-nums">
                  {match.homeGoals ?? 0} - {match.awayGoals ?? 0}
                </span>

                <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                  <span className="truncate text-right text-sm font-semibold">{match.awayTeamName}</span>
                  {match.awayTeamCrest ? (
                    <Image src={match.awayTeamCrest} alt="" width={32} height={32} className="h-8 w-8 object-contain" unoptimized />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold">
                      {match.awayTeamShortName.slice(0, 2)}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
