import { useQuery } from '@tanstack/react-query'
import { getStandings } from '@/lib/api'

export function useStandings(leagueId: string, seasonId?: string) {
  return useQuery({
    queryKey: ['standings', leagueId, seasonId ?? 'current'],
    queryFn: () => getStandings(leagueId, seasonId)
  })
}
