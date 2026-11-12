"use client";

import { useEffect } from "react";
import { useLiveStore } from "@/store/useLiveStore";

export function useMatchLive() {
  const liveMatches = useLiveStore((state) => state.liveMatches);
  const isConnected = useLiveStore((state) => state.isConnected);
  const isInitializing = useLiveStore((state) => state.isInitializing);
  const connect = useLiveStore((state) => state.connect);
  const disconnect = useLiveStore((state) => state.disconnect);

  useEffect(() => {
    void connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    liveMatches,
    liveMatchesArray: Object.values(liveMatches),
    isConnected,
    isInitializing,
  };
}
