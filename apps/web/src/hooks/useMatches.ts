import { useQuery } from '@tanstack/react-query'
import { getLeagueMatches, getLiveMatches, getTeamRecentMatches } from '@/lib/api'

export function useMatches(leagueId: string, seasonId?: string) {
  return useQuery({
    queryKey: ['matches', 'league', leagueId, seasonId ?? 'current'],
    queryFn: () => getLeagueMatches(leagueId, seasonId),
    enabled: !!leagueId
  })
}

export function useLiveMatches() {
  return useQuery({
    queryKey: ['live-matches'],
    queryFn: () => getLiveMatches()
  })
}

export function useUpcomingMatches(teamId?: string) {
  return useQuery({
    queryKey: ['upcoming-matches', teamId],
    queryFn: () => getTeamRecentMatches(teamId!),
    enabled: !!teamId
  })
}
