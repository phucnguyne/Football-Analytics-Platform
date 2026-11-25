'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useFormatter, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { DataSourceLabel } from '@/components/ui/DataSourceLabel'
import type { ScoutingReportData } from '@/lib/scouting-report'

export function ScoutingReport({ report }: { report: ScoutingReportData }) {
  const t = useTranslations('Scout')
  const team = useTranslations('Team')
  const m = useTranslations('Export')
  const common = useTranslations('Common')
  const format = useFormatter()
  const { standing, recentForm, keyPlayers } = report

  return (
    <article className="space-y-6 print:space-y-4">
      <header className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-6">
        {report.crest && <Image src={report.crest} alt="" width={56} height={56} unoptimized />}
        <div className="grow">
          <h1 className="text-3xl font-bold">{report.teamName}</h1>
          <p className="text-sm text-muted-foreground">{[report.venue, report.founded].filter(Boolean).join(' · ')}</p>
        </div>
        <Button variant="outline" onClick={() => window.print()} className="print:hidden">{t('pdf')}</Button>
      </header>

      <section className="space-y-3 rounded-2xl border bg-card p-6">
        <div className="flex items-center gap-2">
          <h2 className="font-bold">{t('standing')}</h2>
          <DataSourceLabel kind={standing ? 'real' : 'unavailable'} />
        </div>
        {standing ? (
          <>
            <p className="font-medium">{standing.league} · {standing.year} · #{standing.position}</p>
            <p className="text-sm text-muted-foreground">
              {t('standingSummary', { points: standing.points, played: standing.playedGames, wins: standing.wins,
                draws: standing.draws, losses: standing.losses, goalsFor: standing.goalsFor, goalsAgainst: standing.goalsAgainst })}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('standingUpdated', { date: format.dateTime(new Date(standing.updatedAt), { dateStyle: 'medium', timeZone: 'UTC' }) })}
            </p>
          </>
        ) : <p className="text-sm text-muted-foreground">{common('empty')}</p>}
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-6">
        <div className="flex items-center gap-2">
          <h2 className="font-bold">{t('recent')}</h2>
          <DataSourceLabel kind={recentForm.length ? 'real' : 'unavailable'} />
        </div>
        {recentForm.length ? (
          <ul className="divide-y">
            {recentForm.map((match) => (
              <li key={match.id} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <Link href={`/matches/${match.id}`} className="font-medium hover:underline">{match.opponent}</Link>
                  <p className="text-xs text-muted-foreground">
                    {format.dateTime(new Date(match.date), { dateStyle: 'medium' })} · {match.competition} · {t(match.isHome ? 'home' : 'away')}
                  </p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums">{match.goalsFor}–{match.goalsAgainst} · {match.result}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">{team('noMatches')}</p>}
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-bold">{t('keyPlayers')}{report.playerStatsSeason ? ` · ${report.playerStatsSeason}` : ''}</h2>
          <DataSourceLabel kind={keyPlayers.length ? 'real' : 'unavailable'} />
        </div>
        {keyPlayers.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-sm">
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th scope="col" className="py-2 pr-4 text-left">{t('player')}</th>
                  <th scope="col" className="px-2 text-right">{m('matches')}</th>
                  <th scope="col" className="px-2 text-right">{m('goals')}</th>
                  <th scope="col" className="pl-2 text-right">{m('assists')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {keyPlayers.map((player) => (
                  <tr key={player.id}>
                    <th scope="row" className="py-2 pr-4 text-left font-medium">
                      <Link href={`/players/${player.id}`} className="hover:underline">{player.name}</Link>
                    </th>
                    <td className="px-2 text-right tabular-nums">{player.matchesPlayed}</td>
                    <td className="px-2 text-right tabular-nums">{player.goals}</td>
                    <td className="pl-2 text-right tabular-nums">{player.assists}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-muted-foreground">{t('playerStatsUnavailable')}</p>}
      </section>
    </article>
  )
}
