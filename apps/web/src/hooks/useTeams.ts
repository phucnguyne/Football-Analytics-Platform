import { useQuery } from '@tanstack/react-query'
import { getTeams, getTeam } from '@/lib/api'

export function useTeams(leagueId: string, seasonId?: string) {
  return useQuery({
    queryKey: ['teams', leagueId, seasonId ?? 'current'],
    queryFn: () => getTeams(leagueId, seasonId),
    enabled: !!leagueId,
    staleTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  })
}

export function useTeam(teamId: string) {
  return useQuery({
    queryKey: ['team', teamId],
    queryFn: () => getTeam(teamId),
    enabled: !!teamId
  })
}
