'use client'

import { useEffect, useState } from 'react'
import { useLiveStore, LiveMatchUpdate } from '@/store/useLiveStore'



export function useMatchLive() {
  const store = useLiveStore();

  useEffect(() => {
    store.connect();
    // Do NOT disconnect on unmount if we want persistent global connection,
    // OR we could do reference counting. For simplicity, we just keep it connected
    // while the app is mounted (LiveScoreboard is in layout so it never unmounts).
  }, [store]);

  return {
    liveMatches: store.liveMatches,
    liveMatchesArray: Object.values(store.liveMatches),
    isConnected: store.isConnected,
    isInitializing: store.isInitializing,
  }
}
