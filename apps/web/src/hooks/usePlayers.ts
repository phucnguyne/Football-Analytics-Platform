import { useQuery } from '@tanstack/react-query'
import { getPlayers, getPlayer } from '@/lib/api'

export function usePlayers(teamId: string) {
  return useQuery({
    queryKey: ['players', 'team', teamId, 'photos'],
    queryFn: () => getPlayers(teamId),
    enabled: !!teamId,
    staleTime: 5 * 60 * 1000,
  })
}

export function usePlayer(playerId: string) {
  return useQuery({
    queryKey: ['player', playerId],
    queryFn: () => getPlayer(playerId),
    enabled: !!playerId,
    staleTime: 5 * 60 * 1000,
  })
}
