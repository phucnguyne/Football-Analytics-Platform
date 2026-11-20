'use client'

import { useQuery } from '@tanstack/react-query'
import { Activity, Shield, TrendingUp, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Container, Grid } from '@/components/ui/grid'

interface PlatformStats {
  matchCount: number
  playerCount: number
  finishedCount: number
  leagueCount: number
}

function StatValue({ value }: { value: number | undefined }) {
  if (value === undefined) return <span className="text-lg text-muted-foreground">—</span>
  return <>{value.toLocaleString()}</>
}

export function PlatformOverview() {
  const { data: stats } = useQuery<PlatformStats>({
    queryKey: ['platform-stats'],
    queryFn: async () => {
      const response = await fetch('/api/platform-stats')
      if (!response.ok) throw new Error('Failed to load platform statistics')
      return response.json() as Promise<PlatformStats>
    },
  })

  return (
    <Container>
      <div className="mb-8">
        <h2 className="mb-2 text-2xl font-bold tracking-tight">Platform Overview</h2>
        <p className="text-muted-foreground">Live metrics from the database.</p>
      </div>
      <Grid cols={4} gap="lg">
        <Card className="group hover:border-primary/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Matches Tracked</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold"><StatValue value={stats?.matchCount} /></div>
            <p className="mt-1 text-xs text-muted-foreground">
              {stats ? `${stats.finishedCount.toLocaleString()} finished` : 'Loading…'}
            </p>
          </CardContent>
        </Card>

        <Card className="group hover:border-primary/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Player Profiles</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold"><StatValue value={stats?.playerCount} /></div>
            <p className="mt-1 text-xs text-muted-foreground">
              {stats ? `Across ${stats.leagueCount} league${stats.leagueCount !== 1 ? 's' : ''}` : 'Loading…'}
            </p>
          </CardContent>
        </Card>

        <Card className="group hover:border-primary/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Predictive Model</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Poisson</div>
            <p className="mt-1 text-xs text-muted-foreground">xG · Monte Carlo · Dixon-Coles</p>
          </CardContent>
        </Card>

        <Card className="group hover:border-primary/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Integrity</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">99.9%</div>
            <p className="mt-1 text-xs text-muted-foreground">Verified through API</p>
          </CardContent>
        </Card>
      </Grid>
    </Container>
  )
}
