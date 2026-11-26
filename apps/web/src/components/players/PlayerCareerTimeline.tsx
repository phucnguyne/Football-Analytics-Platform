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
  const { clubs = [], seasonStats, verifiedSeasons } = history.isError ? {} : history.data ?? {}
  const date = (value: string) => format.dateTime(new Date(value), { dateStyle: 'medium', timeZone: 'UTC' })

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xl font-bold">{t('career')}{playerName && ` · ${playerName}`}</h3>
        <DataSourceLabel kind={clubs.length || seasonStats || verifiedSeasons?.length ? 'real' : 'unavailable'} detail={clubs[0]?.source === 'api-football' ? 'API-Football' : undefined} />
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
      {!!verifiedSeasons?.length && (
        <div className="space-y-2 border-t pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold">{t('verifiedSeasonStats')}</h4>
            <DataSourceLabel kind="real" detail="API-Football" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="text-left" scope="col">{m('club')}</th>
                  <th className="text-right" scope="col">{m('matches')}</th>
                  <th className="text-right" scope="col">{m('minutes')}</th>
                  <th className="text-right" scope="col">{m('goals')}</th>
                  <th className="text-right" scope="col">{m('assists')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {verifiedSeasons.map((row) => (
                  <tr key={`${row.year}-${row.team}`}>
                    <th className="py-2 pr-4 text-left font-medium" scope="row">{row.team} · {row.year}/{String(row.year + 1).slice(-2)}</th>
                    {(['matchesPlayed', 'minutesPlayed', 'goals', 'assists'] as const).map((key) => (
                      <td key={key} className="px-2 text-right tabular-nums">{row[key] ?? '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}
