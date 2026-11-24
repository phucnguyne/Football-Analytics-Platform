'use client'

import Link from 'next/link'
import { loginLink } from '@/lib/login-link'
import { useSession } from 'next-auth/react'
import { useLocale, useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { DataSourceLabel } from '@/components/ui/DataSourceLabel'
import { ChartSkeleton } from '@/components/ui/Skeleton'

type Insight = {
  state: 'ready'
  kind: 'preview' | 'review'
  text: string
  model: string | null
} | { state: 'missing' | 'pending' | 'disabled' | 'unavailable' }

export function MatchInsight({ matchId, status }: { matchId: string; status: string }) {
  const t = useTranslations('Insights')
  const locale = useLocale()
  const { status: authStatus } = useSession()
  const eligible = ['TIMED', 'SCHEDULED', 'FINISHED'].includes(status)
  const { data, isLoading, isError } = useQuery<Insight>({
    queryKey: ['match-insight', matchId, status, locale, authStatus],
    enabled: eligible && authStatus !== 'loading',
    staleTime: 5 * 60_000,
    retry: false,
    refetchInterval: (query) => query.state.data?.state === 'pending' && query.state.dataUpdateCount < 8 ? 3000 : false,
    queryFn: async ({ signal }) => {
      const url = `/api/matches/${matchId}/insights?locale=${locale}`
      const result = await fetch(url, { signal })
      if (!result.ok) throw new Error('Insight unavailable')
      const cached: Insight = await result.json()
      if (cached.state !== 'missing' || authStatus !== 'authenticated') return cached

      const generated = await fetch(url, { method: 'POST', signal })
      if (!generated.ok) throw new Error('Insight unavailable')
      return generated.json()
    },
  })

  if (!eligible || data?.state === 'disabled') return null
  if (isLoading) return <ChartSkeleton className="h-32" />
  if (!data && !isError) return null

  return (
    <section className="space-y-2 rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold">{t(data?.state === 'ready' ? data.kind : status === 'FINISHED' ? 'review' : 'preview')}</h2>
        {data?.state === 'ready' && <DataSourceLabel kind="generated" detail={data.model ?? 'AI'} />}
      </div>
      {data?.state === 'missing' ? (
        <Link href={loginLink(`/matches/${matchId}`)} className="text-sm text-primary hover:underline">{t('missing')}</Link>
      ) : (
        <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground" role="status">
          {data?.state === 'ready' ? data.text : t(data?.state === 'pending' ? 'pending' : 'unavailable')}
        </p>
      )}
    </section>
  )
}
