'use client'
import { useState } from 'react'
import { Container, Grid } from '@/components/ui/grid'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { usePlayers } from '@/hooks/usePlayers'
import { useTeams } from '@/hooks/useTeams'
import { PageSpinner } from '@/components/ui/Spinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { cn } from '@/lib/utils'

import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect } from 'react'
import Link from 'next/link'

// Premier League competition code on football-data.org
const DEFAULT_LEAGUE = 'PL'

function PositionBadge({ position }: { position: string }) {
  const pos = position.toUpperCase()
  const color =
    pos.includes('GOAL') ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
    pos.includes('DEF')  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
    pos.includes('MID')  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                           'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
  return (
    <span className={cn('px-2 py-0.5 text-[10px] font-bold tracking-wider rounded uppercase', color)}>
      {position}
    </span>
  )
}

function PlayersContent() {
  const searchParams = useSearchParams()
  const urlTeamId = searchParams.get('teamId')
  
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (urlTeamId) {
      setSelectedTeamId(urlTeamId)
    }
  }, [urlTeamId])

  const { data: teams } = useTeams(DEFAULT_LEAGUE)
  const activeTeam = selectedTeamId || teams?.[0]?.id || ''
  const { data: players, isLoading, isError, refetch } = usePlayers(activeTeam)

  const filtered = players?.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Container className="py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Players</h1>
        <p className="text-muted-foreground">Browse squads across the Premier League</p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <select
          className="flex h-10 w-full sm:w-64 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={selectedTeamId}
          onChange={(e) => setSelectedTeamId(e.target.value)}
        >
          {teams?.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <Input
          placeholder="Search players…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
      </div>

      {isLoading && <PageSpinner />}
      {isError && <ErrorMessage onRetry={refetch} />}

      {filtered && filtered.length === 0 && !isLoading && (
        <p className="text-center text-muted-foreground py-12">No players found.</p>
      )}

      <Grid cols={4} gap="lg">
        {filtered?.map((player) => (
          <Link href={`/players/${player.id}`} key={player.id}>
            <Card className="group hover:border-primary/50 transition-all h-full cursor-pointer">
              <CardHeader className="items-center text-center pb-2">
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-2 overflow-hidden border-2 border-primary/20">
                  {player.photo ? (
                    <img src={player.photo} alt={player.name} className="w-full h-full object-cover" />
                  ) : (
                    <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(player.name)}&background=random&size=128`} alt={player.name} className="w-full h-full object-cover" />
                  )}
                </div>
                <CardTitle className="text-sm group-hover:text-primary transition-colors">
                  {player.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-1 pt-0">
                {player.position && (
                  <PositionBadge position={String(player.position)} />
                )}
                {player.nationality && (
                  <p className="text-xs text-muted-foreground">{player.nationality}</p>
                )}
                {player.shirtNumber && (
                  <p className="text-xs text-muted-foreground">#{player.shirtNumber}</p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </Grid>
    </Container>
  )
}

export default function PlayersPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <PlayersContent />
    </Suspense>
  )
}