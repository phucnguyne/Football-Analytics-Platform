import { useEffect } from 'react'
import { io } from 'socket.io-client'
import { useLiveStore } from '@/store/liveStore'

const SOCKET_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:4000'

export function useLiveScoreSocket() {
  const { updateScore } = useLiveStore()

  useEffect(() => {
    const socket = io(SOCKET_URL)
    
    socket.on('score_update', (data: { matchId: string, home: number, away: number }) => {
      updateScore(data.matchId, data.home, data.away)
    })

    return () => {
      socket.disconnect()
    }
  }, [updateScore])
}

export function useMatchSocket(matchId: string) {
  useEffect(() => {
    if (!matchId) return
    const socket = io(SOCKET_URL)
    
    socket.emit('subscribe_match', matchId)
    
    return () => {
      socket.emit('unsubscribe_match', matchId)
      socket.disconnect()
    }
  }, [matchId])
}
