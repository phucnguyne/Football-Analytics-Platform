'use client'
import { use, useMemo } from 'react'
import Image from 'next/image'
import { Container } from '@/components/ui/grid'
import { useQuery } from '@tanstack/react-query'
import { getTeam, getTeamAllMatches } from '@/lib/api'
import { PageSpinner } from '@/components/ui/Spinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { MatchCard } from '@/components/matches/MatchCard'
import Link from 'next/link'
import type { Match } from '@/types/TypesBarrel'

export default function TeamDetailsPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params)
  
  const { data: team, isLoading, isError } = useQuery({
    queryKey: ['team', teamId],
    queryFn: () => getTeam(teamId),
    enabled: !!teamId
  })

  const { data: matches } = useQuery({
    queryKey: ['team-matches', teamId],
    queryFn: () => getTeamAllMatches(teamId),
    enabled: !!teamId
  })

  // Group matches by competition name
  const matchesByCompetition = useMemo(() => {
    if (!matches) return []
    const groups: Record<string, Match[]> = {}
    matches.forEach(m => {
      const compName = m.competition?.name || 'Other'
      if (!groups[compName]) groups[compName] = []
      groups[compName].push(m)
    })
    return Object.entries(groups).map(([comp, matchList]) => ({ comp, matches: matchList }))
  }, [matches])

  if (isLoading) return <PageSpinner />
  if (isError || !team) return <ErrorMessage />

  return (
    <Container size="2xl" className="py-10">
      {/* Back link */}
      <Link href="/teams" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-6">
        ← Back to Teams
      </Link>

      {/* Header */}
      <div className="flex items-center gap-6 mb-10">
        {team.crest && (
          <Image src={team.crest} alt={team.name} width={100} height={100} className="object-contain" />
        )}
        <div className="flex-1">
          <h1 className="text-4xl font-bold">{team.name}</h1>
          <p className="text-xl text-muted-foreground">{team.shortName}</p>
        </div>
        <Link
          href={`/players?teamId=${teamId}`}
          className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors shadow-lg"
        >
          View All Players
        </Link>
      </div>

      {/* Info cards */}
      <div className="grid md:grid-cols-2 gap-8 mb-12">
        <div className="bg-card p-6 rounded-2xl border">
          <h2 className="text-2xl font-semibold mb-4">Club Information</h2>
          <dl className="grid grid-cols-2 gap-y-4">
            <dt className="text-muted-foreground">Founded</dt>
            <dd className="font-medium">{team.founded || 'N/A'}</dd>
            <dt className="text-muted-foreground">Venue</dt>
            <dd className="font-medium">{team.venue || 'N/A'}</dd>
            <dt className="text-muted-foreground">Club Colors</dt>
            <dd className="font-medium">{team.clubColors || 'N/A'}</dd>
            <dt className="text-muted-foreground">Address</dt>
            <dd className="font-medium">{team.address || 'N/A'}</dd>
            <dt className="text-muted-foreground">Website</dt>
            <dd className="font-medium">
              {team.website ? <a href={team.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">{team.website}</a> : 'N/A'}
            </dd>
          </dl>
        </div>

        <div className="bg-card p-6 rounded-2xl border">
          <h2 className="text-2xl font-semibold mb-4">Club Details</h2>
          <dl className="grid grid-cols-2 gap-y-4">
            <dt className="text-muted-foreground">Owner</dt>
            <dd className="font-medium">{team.owner || 'N/A'}</dd>
            <dt className="text-muted-foreground">Sponsor</dt>
            <dd className="font-medium">{team.sponsor || 'N/A'}</dd>
          </dl>
          <div className="mt-6">
            <h3 className="font-medium mb-2">History</h3>
            <p className="text-sm text-muted-foreground">{team.history || 'No history available.'}</p>
          </div>
        </div>
      </div>

      {/* Full Season Matches History - grouped by competition */}
      <div>
        <h2 className="text-2xl font-bold mb-6">Full Season Matches History</h2>
        
        {matchesByCompetition.length === 0 && (
          <p className="text-muted-foreground text-center py-8">No matches found.</p>
        )}

        <div className="space-y-10">
          {matchesByCompetition.map(({ comp, matches: compMatches }) => (
            <div key={comp}>
              <div className="flex items-center gap-3 mb-6">
                <span className="text-lg font-semibold text-primary">{comp}</span>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{compMatches.length} matches</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {compMatches.map((match: Match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Container>
  )
}
