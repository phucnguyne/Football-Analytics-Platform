'use client'

import dynamic from 'next/dynamic'
import { useFormatter, useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { DataSourceLabel } from '@/components/ui/DataSourceLabel'
import { ChartSkeleton } from '@/components/ui/Skeleton'
import type { buildStatsBombPassingNetwork, buildStatsBombTeamTacticalMetrics } from '@/lib/statsbomb'

const PassingNetwork = dynamic(() => import('./PassingNetwork').then((module) => module.PassingNetwork))

interface TacticalData {
  available: boolean
  teams: {
    id: number
    name: string
    crest: string | null
    formation: number | null
    lineup: { id: number; name: string; shirtNumber: number | null; position: string | null; isStarter: boolean }[]
    passingNetwork: ReturnType<typeof buildStatsBombPassingNetwork> | null
    metrics: ReturnType<typeof buildStatsBombTeamTacticalMetrics> | null
  }[]
}

export function TacticalInsights({ matchId }: { matchId: string | number }) {
  const t = useTranslations('Match')
  const common = useTranslations('Common')
  const format = useFormatter()
  const { data, isLoading, isError } = useQuery<TacticalData>({
    queryKey: ['tactics', matchId],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/matches/${matchId}/tactics`, { signal })
      if (!res.ok) throw new Error('Failed to fetch tactical data')
      return res.json()
    },
    enabled: Number(matchId) > 0,
    placeholderData: undefined,
    staleTime: 60 * 1000,
  })

  if (isLoading) return <ChartSkeleton className="h-56" />
  if (isError || !data) return <div className="rounded-2xl border bg-card p-6 text-muted-foreground">{t('noTactics')}</div>

  return (
    <section className="space-y-5 rounded-2xl border bg-card p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xl font-semibold">{t('tactics')}</h3>
        <DataSourceLabel kind={data.available ? 'real' : 'unavailable'} detail={data.available ? 'StatsBomb Open Data' : undefined} />
      </div>
      {!data.available && <p className="text-sm text-muted-foreground">{t('noTactics')}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {data.teams.map((team) => (
          <div key={team.id} className="rounded-xl border p-4">
            <h4 className="font-semibold">{team.name}</h4>
            {team.metrics && (
              <dl className="my-3 grid grid-cols-2 gap-2 text-sm">
                <div><dt>{t('passCount')}</dt><dd>{format.number(team.metrics.passes)}</dd></div>
                <div><dt>PPDA</dt><dd>{team.metrics.ppda === null ? '—' : format.number(team.metrics.ppda)}</dd></div>
              </dl>
            )}
            <h5 className="mt-3 text-sm font-medium">{t('confirmed')}{team.formation ? ` · ${String(team.formation).split('').join('-')}` : ''}</h5>
            {team.lineup.length ? (
              <ul className="mt-2 space-y-1 text-sm">
                {team.lineup.map((player) => (
                  <li key={player.id} className="flex items-center gap-2">
                    <span className="w-7 text-right tabular-nums text-muted-foreground">{player.shirtNumber ?? '—'}</span>
                    {player.name}
                    {!player.isStarter && <span className="text-xs text-muted-foreground">{t('sub')}</span>}
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-muted-foreground">{common('empty')}</p>}
          </div>
        ))}
      </div>
      {data.teams.map((team) => {
        if (!team.passingNetwork?.nodes.length) return null
        const { nodes, links } = team.passingNetwork
        const lineup = new Map(team.lineup.map((player) => [player.id, player]))
        return (
          <PassingNetwork
            key={team.id}
            teamName={team.name}
            teamCrest={team.crest ?? undefined}
            nodes={nodes.map((node) => ({
              ...node, shortName: node.name.split(' ').at(-1) ?? node.name,
              shirtNumber: lineup.get(node.id)?.shirtNumber ?? null,
              position: lineup.get(node.id)?.position ?? '—',
              x: node.x * 100 / 120, y: node.y * 100 / 80,
            }))}
            links={links}
          />
        )
      })}
    </section>
  )
}
