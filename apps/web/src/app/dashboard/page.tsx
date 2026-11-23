'use client'

import Link from 'next/link'
import { signOut, useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { useFormatter, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Container } from '@/components/ui/grid'
import { PageSkeleton } from '@/components/ui/Skeleton'
import { PushSettings } from '@/components/dashboard/PushSettings'
import { predictionLabels, type DashboardData } from '@/lib/dashboard'
import { loginLink } from '@/lib/login-link'

export default function DashboardPage() {
  const t = useTranslations('Dashboard')
  const common = useTranslations('Common')
  const search = useTranslations('Search')
  const format = useFormatter()
  const { data: session, status } = useSession()
  const userId = session?.user?.id
  const dashboard = useQuery<DashboardData>({
    queryKey: ['dashboard', userId],
    enabled: !!userId,
    queryFn: async ({ signal }) => {
      const res = await fetch('/api/dashboard', { signal })
      if (!res.ok) throw new Error()
      return res.json()
    },
  })

  if (status === 'loading' || (userId && dashboard.isPending)) return <PageSkeleton />

  const title = <h1 className="text-3xl font-extrabold tracking-tight">{t('title')}</h1>
  if (!userId) {
    return (
      <Container className="space-y-4 py-10">
        {title}
        <p className="text-muted-foreground">{t('signInPrompt')}</p>
        <Button asChild><Link href={loginLink('/dashboard')}>{common('signIn')}</Link></Button>
      </Container>
    )
  }

  if (dashboard.isError || !dashboard.data) {
    return <Container className="space-y-4 py-10">{title}<ErrorMessage message={common('error')} onRetry={dashboard.refetch} /></Container>
  }

  const { teams, fixtures, predictions, pushPublicKey } = dashboard.data
  return (
    <Container className="space-y-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {title}
        <Button variant="outline" onClick={() => signOut({ callbackUrl: '/dashboard' })}>{common('signOut')}</Button>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <section className="space-y-3 rounded-2xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">{t('favoriteTeams')}</h2>
            <Link href="/teams" className="text-sm text-primary hover:underline">{t('findTeams')}</Link>
          </div>
          {teams.length ? (
            <ul className="flex flex-wrap gap-2">
              {teams.map((team) => (
                <li key={team.id}><Link href={`/teams/${team.id}`} className="block rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">{team.name}</Link></li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">{t('noTeams')}</p>}
          <PushSettings key={userId} publicKey={pushPublicKey} />
        </section>
        <section className="space-y-3 rounded-2xl border bg-card p-5">
          <h2 className="text-lg font-bold">{t('upcomingMatches')}</h2>
          {fixtures.length ? (
            <ul className="divide-y">
              {fixtures.map(({ id, homeTeam, awayTeam, utcDate }) => (
                <li key={id}>
                  <Link href={`/matches/${id}`} className="block py-2 text-sm hover:text-primary">
                    <span className="font-semibold">{search('fixture', { home: homeTeam.name, away: awayTeam.name })}</span>
                    <time dateTime={utcDate} className="block text-xs text-muted-foreground">
                      {format.dateTime(new Date(utcDate), { dateStyle: 'medium', timeStyle: 'short', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })}
                    </time>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">{t('noFixtures')}</p>}
        </section>
        <section className="space-y-3 rounded-2xl border bg-card p-5 lg:col-span-2">
          <h2 className="text-lg font-bold">{t('recentPredictions')}</h2>
          {predictions.length ? (
            <ul className="divide-y">
              {predictions.map(({ id, match, prediction, correct }) => (
                <li key={id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <Link href={`/matches/${match.id}`} className="font-semibold hover:text-primary">
                    {search('fixture', { home: match.homeTeam.name, away: match.awayTeam.name })}
                  </Link>
                  <span className="text-muted-foreground">
                    {t(predictionLabels[prediction])} · {t(correct === null ? 'pending' : correct ? 'correct' : 'incorrect')}
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">{t('noPredictions')}</p>}
        </section>
      </div>
    </Container>
  )
}
