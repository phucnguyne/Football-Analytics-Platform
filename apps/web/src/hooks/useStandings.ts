import { useQuery } from '@tanstack/react-query'
import { getStandings } from '@/lib/api'

export function useStandings(leagueId: string) {
  return useQuery({
    queryKey: ['standings', leagueId],
    queryFn: () => getStandings(leagueId)
  })
}
