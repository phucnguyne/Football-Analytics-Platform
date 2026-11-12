"use client";

import { io, type Socket } from "socket.io-client";
import { create } from "zustand";
import { toast } from "react-hot-toast";
import { publicEnv } from "@/lib/public-env";

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

interface RealtimeScoreUpdate {
  matchId: string | number;
  homeScore: number;
  awayScore: number;
  minute: number;
  status: "SCHEDULED" | "LIVE" | "HT" | "FT";
}

interface LiveStoreState {
  liveMatches: Record<number, LiveMatchUpdate>;
  isConnected: boolean;
  isInitializing: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

let socket: Socket | null = null;
let liveConsumers = 0;
let connectPromise: Promise<void> | null = null;

function fromRealtimeStatus(status: RealtimeScoreUpdate["status"]): string {
  if (status === "LIVE") return "IN_PLAY";
  if (status === "HT") return "PAUSED";
  if (status === "FT") return "FINISHED";
  return "SCHEDULED";
}

async function fetchLiveMatches(): Promise<Record<number, LiveMatchUpdate>> {
  const response = await fetch("/api/matches?status=IN_PLAY,PAUSED");
  if (!response.ok)
    throw new Error(`Failed to load live matches (${response.status})`);

  const data = await response.json();
  return (data.matches ?? []).reduce(
    (matches: Record<number, LiveMatchUpdate>, match: any) => {
      matches[match.id] = {
        matchId: match.id,
        status: match.status,
        minute: match.minute ?? null,
        homeTeamId: match.homeTeam.id,
        homeTeamName: match.homeTeam.name,
        homeTeamCrest: match.homeTeam.crest,
        homeTeamShortName: match.homeTeam.shortName,
        awayTeamId: match.awayTeam.id,
        awayTeamName: match.awayTeam.name,
        awayTeamCrest: match.awayTeam.crest,
        awayTeamShortName: match.awayTeam.shortName,
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
      set({ liveMatches: await fetchLiveMatches() });
    } catch (error) {
      console.error("Failed to load live matches", error);
    } finally {
      set({ isInitializing: false });
    }
  };

  const applyScoreUpdate = (update: RealtimeScoreUpdate) => {
    const matchId = Number(update.matchId);
    if (!Number.isInteger(matchId)) return;

    const previous = get().liveMatches[matchId];
    if (!previous) {
      // A scheduled match may just have started. Fetch its display metadata from
      // the web API instead of duplicating team/competition data in Socket.IO.
      void refreshLiveMatches();
      return;
    }

    if (
      update.homeScore > (previous.homeGoals ?? -1) ||
      update.awayScore > (previous.awayGoals ?? -1)
    ) {
      toast.success(
        `⚽ GOAL! ${previous.homeTeamName} ${update.homeScore}-${update.awayScore} ${previous.awayTeamName}`,
        { duration: 5000, position: "top-right" },
      );
    }

    const status = fromRealtimeStatus(update.status);
    if (status === "FINISHED") {
      toast(
        `${previous.homeTeamName} ${update.homeScore}-${update.awayScore} ${previous.awayTeamName}\nMatch Finished`,
        {
          icon: "🏁",
          duration: 5000,
          position: "top-right",
        },
      );
      const { [matchId]: _finishedMatch, ...remainingMatches } =
        get().liveMatches;
      set({ liveMatches: remainingMatches });
      return;
    }

    set({
      liveMatches: {
        ...get().liveMatches,
        [matchId]: {
          ...previous,
          status,
          minute: update.minute,
          homeGoals: update.homeScore,
          awayGoals: update.awayScore,
        },
      },
    });
  };

  return {
    liveMatches: {},
    isConnected: false,
    isInitializing: true,

    connect: async () => {
      liveConsumers += 1;
      if (socket) return;
      if (connectPromise) return connectPromise;

      connectPromise = (async () => {
        await refreshLiveMatches();
        socket = io(publicEnv.NEXT_PUBLIC_WEBSOCKET_URL, {
          transports: ["websocket", "polling"],
          reconnection: true,
        });
        socket.on("connect", () => set({ isConnected: true }));
        socket.on("disconnect", () => set({ isConnected: false }));
        socket.on("connect_error", (error) =>
          console.error("Realtime connection failed", error),
        );
        socket.on("score:updated", applyScoreUpdate);
      })();

      try {
        await connectPromise;
      } finally {
        connectPromise = null;
      }
    },

    disconnect: () => {
      liveConsumers = Math.max(0, liveConsumers - 1);
      if (liveConsumers > 0 || !socket) return;
      socket.disconnect();
      socket = null;
      set({ isConnected: false, isInitializing: true });
    },
  };
});
