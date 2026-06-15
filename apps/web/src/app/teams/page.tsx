'use client'
import Link from 'next/link'
import Image from 'next/image'
import { Container, Grid } from '@/components/ui/grid'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useTeams } from '@/hooks/useTeams'
import { PageSpinner } from '@/components/ui/Spinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'

// Premier League competition code on football-data.org
const DEFAULT_LEAGUE = 'PL'

export default function TeamsPage() {
  const { data: teams, isLoading, isError, refetch } = useTeams(DEFAULT_LEAGUE)

  return (
    <Container className="py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Teams</h1>
        <p className="text-muted-foreground">All clubs in the Premier League</p>
      </div>

      {isLoading && <PageSpinner />}
      {isError && <ErrorMessage onRetry={refetch} />}

      {teams && teams.length === 0 && (
        <p className="text-center text-muted-foreground py-12">No teams found.</p>
      )}

      <Grid cols={4} gap="lg">
        {teams?.map((team) => (
          <Link key={team.id} href={`/team/${team.id}`}>
            <Card className="group hover:border-primary/50 transition-all cursor-pointer h-full">
              <CardHeader className="items-center text-center pb-2">
                {team.crest ? (
                  <Image
                    src={team.crest}
                    alt={team.name}
                    width={64}
                    height={64}
                    className="object-contain mb-2"
                    unoptimized
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-2">
                    <span className="text-lg font-bold text-muted-foreground">
                      {team.shortName?.slice(0, 2) ?? team.name.slice(0, 2)}
                    </span>
                  </div>
                )}
                <CardTitle className="text-sm group-hover:text-primary transition-colors">
                  {team.name}
                </CardTitle>
              </CardHeader>
              {(team.venue || team.founded) && (
                <CardContent className="text-center text-xs text-muted-foreground pt-0">
                  {team.venue && <p className="truncate">{team.venue}</p>}
                  {team.founded && <p>Est. {team.founded}</p>}
                </CardContent>
              )}
            </Card>
          </Link>
        ))}
      </Grid>
    </Container>
  )
}