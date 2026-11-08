'use client'

import { useEffect } from 'react'
import { useLiveStore } from '@/store/useLiveStore'

let liveConsumers = 0

export function useMatchLive() {
  const liveMatches = useLiveStore((state) => state.liveMatches)
  const isConnected = useLiveStore((state) => state.isConnected)
  const isInitializing = useLiveStore((state) => state.isInitializing)
  const connect = useLiveStore((state) => state.connect)
  const disconnect = useLiveStore((state) => state.disconnect)

  useEffect(() => {
    liveConsumers += 1
    void connect()
    return () => {
      liveConsumers -= 1
      if (liveConsumers === 0) disconnect()
    }
  }, [connect, disconnect])

  return {
    liveMatches,
    liveMatchesArray: Object.values(liveMatches),
    isConnected,
    isInitializing,
  }
}
