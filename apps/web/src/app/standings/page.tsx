'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getStandings } from '@/lib/api'
import { Container } from '@/components/ui/grid'
import { PageSpinner } from '@/components/ui/Spinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import Image from 'next/image'
import Link from 'next/link'
import { SeasonSelector } from '@/components/seasons/SeasonSelector'

export default function StandingsPage() {
  const [seasonId, setSeasonId] = useState('')
  const { data: standings, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['standings', 'PL', seasonId || 'current'],
    queryFn: () => getStandings('PL', seasonId),
  })

  if (isLoading) return <PageSpinner />
  if (isError || !standings) {
    return (
      <Container className="py-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-3xl font-black tracking-tighter">Premier League Standings</h1>
          <SeasonSelector competition="PL" value={seasonId} onChange={setSeasonId} />
        </div>
        <ErrorMessage
          message={error instanceof Error ? error.message : 'Standings are unavailable for this season.'}
          onRetry={refetch}
        />
      </Container>
    )
  }

  return (
    <Container className="py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-black tracking-tighter">Premier League Standings</h1>
        <SeasonSelector competition="PL" value={seasonId} onChange={setSeasonId} />
      </div>
      
      <div className="bg-card rounded-2xl border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b">
              <tr>
                <th className="px-6 py-4 font-semibold text-center w-16">#</th>
                <th className="px-6 py-4 font-semibold">Club</th>
                <th className="px-4 py-4 font-semibold text-center">MP</th>
                <th className="px-4 py-4 font-semibold text-center">W</th>
                <th className="px-4 py-4 font-semibold text-center">D</th>
                <th className="px-4 py-4 font-semibold text-center">L</th>
                <th className="px-4 py-4 font-semibold text-center hidden md:table-cell">GF</th>
                <th className="px-4 py-4 font-semibold text-center hidden md:table-cell">GA</th>
                <th className="px-4 py-4 font-semibold text-center">GD</th>
                <th className="px-6 py-4 font-bold text-center text-primary text-base">Pts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {standings.map((row) => (
                <tr key={row.team.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4 text-center font-bold">
                    <span className={`
                      inline-flex items-center justify-center w-6 h-6 rounded-full text-xs
                      ${row.position <= 4 ? 'bg-blue-500/20 text-blue-500' : 
                        row.position === 5 ? 'bg-orange-500/20 text-orange-500' : 
                        row.position >= 18 ? 'bg-red-500/20 text-red-500' : ''}
                    `}>
                      {row.position}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Link href={`/teams/${row.team.id}`} className="flex items-center gap-3 hover:text-primary transition-colors">
                      {row.team.crest ? (
                        <Image src={row.team.crest} alt={row.team.name} width={24} height={24} className="object-contain w-6 h-6" />
                      ) : (
                        <div className="w-6 h-6 bg-muted rounded-full" />
                      )}
                      <span className="font-bold">{row.team.name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-4 text-center text-muted-foreground">{row.playedGames}</td>
                  <td className="px-4 py-4 text-center">{row.won}</td>
                  <td className="px-4 py-4 text-center">{row.draw}</td>
                  <td className="px-4 py-4 text-center">{row.lost}</td>
                  <td className="px-4 py-4 text-center hidden md:table-cell">{row.goalsFor}</td>
                  <td className="px-4 py-4 text-center hidden md:table-cell">{row.goalsAgainst}</td>
                  <td className="px-4 py-4 text-center font-medium">{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                  <td className="px-6 py-4 text-center font-black text-primary text-base">{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Container>
  )
}
