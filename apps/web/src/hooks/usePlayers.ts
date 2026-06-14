import { useQuery } from '@tanstack/react-query'
import { getPlayers, getPlayer } from '@/lib/api'

export function usePlayers(teamId: string) {
  return useQuery({
    queryKey: ['players', 'team', teamId],
    queryFn: () => getPlayers(teamId),
    enabled: !!teamId
  })
}

export function usePlayer(playerId: string) {
  return useQuery({
    queryKey: ['player', playerId],
    queryFn: () => getPlayer(playerId),
    enabled: !!playerId
  })
}
