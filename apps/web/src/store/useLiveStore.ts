"use client";

import { create } from "zustand";
import { toast } from "react-hot-toast";
import { supabase } from "@/lib/supabase-browser";
import type { FootballDataMatch } from "@/types/TypesBarrel";

export interface LiveMatchUpdate {
  matchId: number;
  status: string;
  minute: number | null;
  homeTeamId: number;
  homeTeamName: string;
  homeTeamCrest: string | null;
  homeTeamShortName: string;
  awayTeamId: number;
  awayTeamName: string;
  awayTeamCrest: string | null;
  awayTeamShortName: string;
  homeGoals: number | null;
  awayGoals: number | null;
  competition: string;
  matchday: number | null;
}

interface LiveStoreState {
  liveMatches: Record<number, LiveMatchUpdate>;
  isConnected: boolean;
  isInitializing: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let liveConsumers = 0;
let connectPromise: Promise<void> | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

async function fetchLiveMatches(): Promise<Record<number, LiveMatchUpdate>> {
  const response = await fetch("/api/matches?status=IN_PLAY,PAUSED");
  if (!response.ok)
    throw new Error(`Failed to load live matches (${response.status})`);

  const data = await response.json() as { matches?: FootballDataMatch[] };
  return (data.matches ?? []).reduce(
    (matches: Record<number, LiveMatchUpdate>, match) => {
      matches[match.id] = {
        matchId: match.id,
        status: match.status,
        minute: match.minute ?? null,
        homeTeamId: match.homeTeam.id,
        homeTeamName: match.homeTeam.name,
        homeTeamCrest: match.homeTeam.crest ?? null,
        homeTeamShortName: match.homeTeam.shortName ?? match.homeTeam.name,
        awayTeamId: match.awayTeam.id,
        awayTeamName: match.awayTeam.name,
        awayTeamCrest: match.awayTeam.crest ?? null,
        awayTeamShortName: match.awayTeam.shortName ?? match.awayTeam.name,
        homeGoals: match.score?.fullTime?.home ?? null,
        awayGoals: match.score?.fullTime?.away ?? null,
        competition: match.competition?.name ?? "",
        matchday: match.matchday ?? null,
      };
      return matches;
    },
    {},
  );
}

export const useLiveStore = create<LiveStoreState>((set, get) => {
  const refreshLiveMatches = async () => {
    try {
      const nextMatches = await fetchLiveMatches();
      const previousMatches = get().liveMatches;
      for (const [key, next] of Object.entries(nextMatches)) {
        const previous = previousMatches[Number(key)];
        if (!previous) continue;
        if (
          (next.homeGoals ?? 0) > (previous.homeGoals ?? 0) ||
          (next.awayGoals ?? 0) > (previous.awayGoals ?? 0)
        ) {
          toast.success(
            `⚽ GOAL! ${next.homeTeamName} ${next.homeGoals}-${next.awayGoals} ${next.awayTeamName}`,
            { duration: 5000, position: "top-right" },
          );
        }
        if (previous.status !== "FINISHED" && next.status === "FINISHED") {
          toast(
            `${next.homeTeamName} ${next.homeGoals}-${next.awayGoals} ${next.awayTeamName}\nMatch Finished`,
            { icon: "🏁", duration: 5000, position: "top-right" },
          );
        }
      }
      set({ liveMatches: nextMatches });
    } catch (error) {
      console.error("Failed to load live matches", error);
    } finally {
      set({ isInitializing: false });
    }
  };

  const scheduleRefresh = () => {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => void refreshLiveMatches(), 250);
  };

  return {
    liveMatches: {},
    isConnected: false,
    isInitializing: true,

    connect: async () => {
      liveConsumers += 1;
      if (realtimeChannel) return;
      if (connectPromise) return connectPromise;

      connectPromise = (async () => {
        await refreshLiveMatches();
        realtimeChannel = supabase
          .channel("live-match-updates")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "matches" },
            scheduleRefresh,
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "match_scores" },
            scheduleRefresh,
          )
          .subscribe((status) => {
            set({ isConnected: status === "SUBSCRIBED" });
            if (status === "SUBSCRIBED") scheduleRefresh();
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              console.error(`Supabase Realtime channel status: ${status}`);
            }
          });
      })();

      try {
        await connectPromise;
      } finally {
        connectPromise = null;
      }
    },

    disconnect: () => {
      liveConsumers = Math.max(0, liveConsumers - 1);
      if (liveConsumers > 0 || !realtimeChannel) return;
      if (refreshTimer) clearTimeout(refreshTimer);
      void supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
      set({ isConnected: false, isInitializing: true });
    },
  };
});

// Legacy VM + Socket.IO client path retained for reference:
// const socket = io(NEXT_PUBLIC_WEBSOCKET_URL);
// socket.on("score:updated", applyScoreUpdate);
