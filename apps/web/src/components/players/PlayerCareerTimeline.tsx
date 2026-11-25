'use client'

import { useQuery } from '@tanstack/react-query'
import { useFormatter, useTranslations } from 'next-intl'
import { DataSourceLabel } from '@/components/ui/DataSourceLabel'
import { ChartSkeleton } from '@/components/ui/Skeleton'
import type { CareerHistory } from '@/lib/career-history'

export function PlayerCareerTimeline({ playerId, playerName }: { playerId: number; playerName?: string }) {
  const t = useTranslations('Player')
  const m = useTranslations('Export')
  const common = useTranslations('Common')
  const format = useFormatter()
  const history = useQuery<CareerHistory>({
    queryKey: ['career', playerId],
    placeholderData: undefined,
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/persons/${playerId}/career`, { signal })
      if (!response.ok) throw new Error('Career data unavailable')
      return response.json()
    },
  })
  if (history.isLoading) return <ChartSkeleton className="h-40" />
  const { clubs = [], seasonStats } = history.isError ? {} : history.data ?? {}
  const date = (value: string) => format.dateTime(new Date(value), { dateStyle: 'medium', timeZone: 'UTC' })

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xl font-bold">{t('career')}{playerName && ` · ${playerName}`}</h3>
        <DataSourceLabel kind={clubs.length || seasonStats ? 'real' : 'unavailable'} detail={clubs[0]?.source === 'api-football' ? 'API-Football' : undefined} />
      </div>
      {history.isError && <button type="button" onClick={() => history.refetch()}>{common('retry')}</button>}
      {clubs.length ? (
        <ul className="divide-y">
          {clubs.map((club, index) => (
            <li key={`${club.id}-${index}`} className="flex flex-wrap justify-between gap-2 py-2">
              <span className="font-medium">{club.name}</span>
              <span className="text-sm text-muted-foreground">
                {club.seasons.length ? club.seasons.join(', ') : club.from || club.to
                  ? `${club.from ? date(club.from) : '—'} – ${club.to ? date(club.to) : '—'}`
                  : '—'}
              </span>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-muted-foreground">{t('careerUnavailable')}</p>}
      {seasonStats && (
        <div className="border-t pt-3">
          <h4 className="font-semibold">{t('verifiedSeasonStats')}{seasonStats.season ? ` · ${seasonStats.season}` : ''}</h4>
          <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(['matchesPlayed', 'minutesPlayed', 'goals', 'assists'] as const).map((key, index) => (
              <div key={key}>
                <dt className="text-xs text-muted-foreground">{m((['matches', 'minutes', 'goals', 'assists'] as const)[index])}</dt>
                <dd className="tabular-nums">{format.number(seasonStats[key])}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  )
}
