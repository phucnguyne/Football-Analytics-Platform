'use client'
import { Container } from '@/components/ui/grid'
import { MatchCard } from '@/components/matches/MatchCard'
import { useMatches } from '@/hooks/useMatches'
import { PageSpinner } from '@/components/ui/Spinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'

// Default: Premier League competition code on football-data.org
const DEFAULT_LEAGUE = 'PL'

export default function MatchesPage() {
  const { data: matches, isLoading, isError, refetch } = useMatches(DEFAULT_LEAGUE)

  return (
    <Container className="py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Matches</h1>
        <p className="text-muted-foreground">Recent results from the Premier League</p>
      </div>

      {isLoading && <PageSpinner />}
      {isError && <ErrorMessage onRetry={refetch} />}

      {matches && matches.length === 0 && (
        <p className="text-center text-muted-foreground py-12">No matches found.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {matches?.map((match) => (
          <MatchCard key={match.id} match={match} />
        ))}
      </div>
    </Container>
  )
}