'use client'

import { useTranslations } from 'next-intl'
import { DataSourceLabel } from '@/components/ui/DataSourceLabel'
import { useQuery } from '@tanstack/react-query'

type DisplayTeam = { name: string; shortName?: string }

export function LiveStatsBars({ matchId, homeTeam, awayTeam, isLive }: { matchId: string; homeTeam: DisplayTeam; awayTeam: DisplayTeam; isLive: boolean }) {
  const t = useTranslations('Match')
  const { data: stats } = useQuery({
    queryKey: ['match-stats', matchId],
    queryFn: async () => {
      const res = await fetch(`/api/matches/${matchId}/stats`)
      if (!res.ok) throw new Error('Failed to fetch stats')
      return res.json()
    },
    refetchInterval: isLive ? 60000 : false,
  })

  if (!stats || !stats.available) {
    return null;
  }

  const statRows = [
    { label: t('possession'), home: stats.possession?.home, away: stats.possession?.away },
    { label: t('shots'), home: stats.shots?.home, away: stats.shots?.away },
    { label: t('onTarget'), home: stats.shotsOnTarget?.home, away: stats.shotsOnTarget?.away },
    { label: t('corners'), home: stats.corners?.home, away: stats.corners?.away },
    { label: t('fouls'), home: stats.fouls?.home, away: stats.fouls?.away },
  ]

  return (
    <div className="bg-card p-6 rounded-2xl border mb-6">
      <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
        <span className="w-2 h-6 bg-primary rounded-full" />
        {t('statistics')}
        <DataSourceLabel kind="real" detail={stats.source === 'api-football' ? 'API-Football' : undefined} />
      </h3>

      <div className="flex justify-between items-center mb-4 px-2">
        <span className="font-bold text-sm uppercase tracking-wider">{homeTeam.shortName || homeTeam.name}</span>
        <span className="font-bold text-sm uppercase tracking-wider">{awayTeam.shortName || awayTeam.name}</span>
      </div>

      <div className="space-y-5">
        {statRows.map((row, i) => {
          const total = (row.home || 0) + (row.away || 0);
          const homePct = total === 0 ? 50 : Math.round(((row.home || 0) / total) * 100);
          const awayPct = 100 - homePct;

          return (
            <div key={i}>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span>{row.home ?? '—'}</span>
                <span className="text-muted-foreground uppercase">{row.label}</span>
                <span>{row.away ?? '—'}</span>
              </div>
              {row.home != null && row.away != null && total > 0 && <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                <div className="bg-blue-500 transition-all duration-1000 ease-out" style={{ width: `${homePct}%` }} />
                <div className="bg-orange-500 transition-all duration-1000 ease-out" style={{ width: `${awayPct}%` }} />
              </div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
