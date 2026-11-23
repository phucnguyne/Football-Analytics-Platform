'use client'

import { DataSourceLabel } from '@/components/ui/DataSourceLabel'
import { useFormatter, useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
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
  const format = useFormatter()
  if (value === undefined) return <span className="text-lg text-muted-foreground">—</span>
  return <>{format.number(value)}</>
}

export function PlatformOverview() {
  const t = useTranslations('Home')
  const common = useTranslations('Common')
  const { data: session } = useSession()
  const isAdmin = session?.user.role === 'ADMIN'
  const { data: stats, isPending } = useQuery<PlatformStats>({
    queryKey: ['platform-stats', session?.user.id],
    enabled: isAdmin,
    queryFn: async () => {
      const response = await fetch('/api/platform-stats')
      if (!response.ok) throw new Error('Failed to load platform statistics')
      return response.json() as Promise<PlatformStats>
    },
  })

  if (!isAdmin) return null

  return (
    <Container>
      <div className="mb-8">
        <h2 className="mb-2 text-2xl font-bold tracking-tight">{t('overview')}</h2>
        <p className="text-muted-foreground">{t('metrics')}</p>
      </div>
      <Grid cols={4} gap="lg">
        <Card className="group hover:border-primary/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('tracked')}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold"><StatValue value={stats?.matchCount} /></div>
            <p className="mt-1 text-xs text-muted-foreground">
              {stats ? t('completed', { count: stats.finishedCount }) : common(isPending ? 'loading' : 'empty')}
            </p>
          </CardContent>
        </Card>

        <Card className="group hover:border-primary/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('profiles')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold"><StatValue value={stats?.playerCount} /></div>
            <p className="mt-1 text-xs text-muted-foreground">
              {stats ? t('competitions', { count: stats.leagueCount }) : common(isPending ? 'loading' : 'empty')}
            </p>
          </CardContent>
        </Card>

        <Card className="group hover:border-primary/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('model')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Poisson</div>
            <p className="mt-1 text-xs text-muted-foreground">xG · Monte Carlo · Dixon-Coles</p>
          </CardContent>
        </Card>

        <Card className="group hover:border-primary/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('leagues')}</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold"><StatValue value={stats?.leagueCount} /></div>
            <DataSourceLabel kind="real" />
          </CardContent>
        </Card>
      </Grid>
    </Container>
  )
}
