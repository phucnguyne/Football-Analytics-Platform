import { useQuery } from '@tanstack/react-query'
import { getTeams, getTeam } from '@/lib/api'

export function useTeams(leagueId: string) {
  return useQuery({
    queryKey: ['teams', leagueId],
    queryFn: () => getTeams(leagueId),
    enabled: !!leagueId
  })
}

export function useTeam(teamId: string) {
  return useQuery({
    queryKey: ['team', teamId],
    queryFn: () => getTeam(teamId),
    enabled: !!teamId
  })
}
