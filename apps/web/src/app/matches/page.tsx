'use client'
import { useMemo, useState } from 'react'
import { Container } from '@/components/ui/grid'
import { MatchCard } from '@/components/matches/MatchCard'
import { useMatches } from '@/hooks/useMatches'
import { PageSpinner } from '@/components/ui/Spinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import type { Match } from '@/types/TypesBarrel'

/** Competitions available on the football-data.org free tier */
const COMPETITIONS = [
  { code: 'PL',  name: 'Premier League',     flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { code: 'BL1', name: 'Bundesliga',         flag: '🇩🇪' },
  { code: 'SA',  name: 'Serie A',            flag: '🇮🇹' },
  { code: 'PD',  name: 'La Liga',            flag: '🇪🇸' },
  { code: 'FL1', name: 'Ligue 1',            flag: '🇫🇷' },
  { code: 'PPL', name: 'Primeira Liga',      flag: '🇵🇹' },
  { code: 'ELC', name: 'Championship',       flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { code: 'DED', name: 'Eredivisie',         flag: '🇳🇱' },
  { code: 'CL',  name: 'Champions League',   flag: '🇪🇺' },
  { code: 'WC',  name: 'FIFA World Cup',     flag: '🌍' },
]

export default function MatchesPage() {
  const [competition, setCompetition] = useState('PL')
  const selectedComp = COMPETITIONS.find((c) => c.code === competition) ?? COMPETITIONS[0]

  const { data: matches, isLoading, isError, refetch } = useMatches(competition)

  // Upcoming matches (next 6)
  const upcomingMatches = useMemo(() => {
    if (!matches) return []
    return matches
      .filter((m) => m.status === 'SCHEDULED' || m.status === 'TIMED')
      .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime())
      .slice(0, 6)
  }, [matches])

  // Group by matchday
  const matchdays = useMemo(() => {
    if (!matches) return []
    const groups: Record<number, Match[]> = {}
    matches.forEach((m) => {
      const day = m.matchday || 0
      if (!groups[day]) groups[day] = []
      groups[day].push(m)
    })
    return Object.entries(groups)
      .map(([day, matchArray]) => ({ day: Number(day), matches: matchArray }))
      .sort((a, b) => a.day - b.day)
  }, [matches])

  return (
    <Container size="2xl" className="py-10">
      {/* Header + Competition Selector */}
      <div className="mb-10 flex flex-col md:flex-row md:items-end gap-4">
        <div className="flex-1">
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">Match Schedule</h1>
          <p className="text-lg text-muted-foreground">
            Full season schedule for the{' '}
            <span className="font-semibold text-foreground">
              {selectedComp.flag} {selectedComp.name}
            </span>
            .
          </p>
        </div>

        {/* League picker */}
        <div className="flex-shrink-0">
          <select
            className="flex h-10 w-full sm:w-56 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={competition}
            onChange={(e) => setCompetition(e.target.value)}
            aria-label="Select competition"
          >
            {COMPETITIONS.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading && <PageSpinner />}
      {isError && <ErrorMessage onRetry={refetch} />}

      {matches && matches.length === 0 && (
        <p className="text-center text-muted-foreground py-12">No matches found for this competition.</p>
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
                  {day === 0 ? 'TBD / Group Stage' : `Matchday ${day}`}
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
