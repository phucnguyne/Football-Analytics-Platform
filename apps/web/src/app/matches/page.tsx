'use client'
import { useMemo } from 'react'
import { Container } from '@/components/ui/grid'
import { MatchCard } from '@/components/matches/MatchCard'
import { useMatches } from '@/hooks/useMatches'
import { PageSpinner } from '@/components/ui/Spinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import type { Match } from '@/types/TypesBarrel'

const DEFAULT_LEAGUE = 'PL'

export default function MatchesPage() {
  const { data: matches, isLoading, isError, refetch } = useMatches(DEFAULT_LEAGUE)

  // Upcoming matches (next 6 matches)
  const upcomingMatches = useMemo(() => {
    if (!matches) return []
    return matches
      .filter((m) => m.status === 'SCHEDULED' || m.status === 'TIMED')
      .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime())
      .slice(0, 6)
  }, [matches])

  // Group matches by matchday
  const matchdays = useMemo(() => {
    if (!matches) return []
    const groups: Record<number, Match[]> = {}
    matches.forEach(m => {
      const day = m.matchday || 0
      if (!groups[day]) groups[day] = []
      groups[day].push(m)
    })
    
    return Object.entries(groups)
      .map(([day, matchArray]) => ({
        day: Number(day),
        matches: matchArray
      }))
      .sort((a, b) => a.day - b.day)
  }, [matches])

  return (
    <Container size="2xl" className="py-10">
      <div className="mb-10 text-center md:text-left">
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">Match Schedule</h1>
        <p className="text-lg text-muted-foreground">Full season schedule for the Premier League.</p>
      </div>

      {isLoading && <PageSpinner />}
      {isError && <ErrorMessage onRetry={refetch} />}

      {matches && matches.length === 0 && (
        <p className="text-center text-muted-foreground py-12">No matches found.</p>
      )}

      {/* Upcoming match schedule */}
      {upcomingMatches.length > 0 && (
        <section className="mb-16">
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60 whitespace-nowrap">
              Upcoming Matches
            </h2>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingMatches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        </section>
      )}

      {/* Full season broken down by matchday */}
      <div className="space-y-12">
        {matchdays.map(({ day, matches: dayMatches }) => (
          <section key={day} className="relative">
            {/* Floating background panel */}
            <div className="absolute inset-0 bg-card/20 backdrop-blur-sm border-5 border-border/30 rounded-2xl -z-10" />
            
            <div className="p-6 md:p-8">
              {/* Matchday header */}
              <div className="flex items-center gap-4 mb-6">
                <h2 className="text-2xl font-bold text-foreground/80 whitespace-nowrap">
                  {day === 0 ? 'TBD / Cup Matches' : `Matchday ${day}`}
                </h2>
                <div className="flex-1 h-px bg-border/30" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {dayMatches.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>
    </Container>
  )
}