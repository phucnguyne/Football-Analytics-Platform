'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useStandings } from '@/hooks/useStandings'
import { PageSpinner } from '@/components/ui/Spinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { cn } from '@/lib/utils'

interface Props { competition?: string }

export function StandingsTable({ competition = 'PL' }: Props) {
  const { data: standings, isLoading, isError, refetch } = useStandings(competition)

  if (isLoading) return <PageSpinner />
  if (isError)   return <ErrorMessage onRetry={refetch} />
  if (!standings?.length) return <div className="py-12 text-center text-muted-foreground">No standings available.</div>

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
          <tr>
            <th className="px-4 py-3 text-left w-8">#</th>
            <th className="px-4 py-3 text-left">Team</th>
            <th className="px-3 py-3 text-center">P</th>
            <th className="px-3 py-3 text-center">W</th>
            <th className="px-3 py-3 text-center">D</th>
            <th className="px-3 py-3 text-center">L</th>
            <th className="px-3 py-3 text-center">GD</th>
            <th className="px-4 py-3 text-center font-bold">Pts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {standings.map((s) => {
            const zone = s.position <= 4 ? 'border-l-2 border-l-blue-500'
                       : s.position <= 6 ? 'border-l-2 border-l-orange-400'
                       : s.position >= standings.length - 2 ? 'border-l-2 border-l-red-500'
                       : ''
            return (
              <tr key={s.team.id} className={cn('hover:bg-muted/30 transition-colors', zone)}>
                <td className="px-4 py-3 text-muted-foreground font-medium">{s.position}</td>
                <td className="px-4 py-3">
                  <Link href={`/teams/${s.team.id}`} className="flex items-center gap-2 hover:underline">
                    {s.team.crest && (
                      <Image src={s.team.crest} alt={s.team.name} width={20} height={20} className="object-contain" />
                    )}
                    <span className="font-medium">{s.team.shortName || s.team.name}</span>
                  </Link>
                </td>
                <td className="px-3 py-3 text-center text-muted-foreground">{s.playedGames}</td>
                <td className="px-3 py-3 text-center text-muted-foreground">{s.wins}</td>
                <td className="px-3 py-3 text-center text-muted-foreground">{s.draws}</td>
                <td className="px-3 py-3 text-center text-muted-foreground">{s.losses}</td>
                <td className="px-3 py-3 text-center text-muted-foreground">
                  {s.goalDifference > 0 ? `+${s.goalDifference}` : s.goalDifference}
                </td>
                <td className="px-4 py-3 text-center font-bold">{s.points}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
