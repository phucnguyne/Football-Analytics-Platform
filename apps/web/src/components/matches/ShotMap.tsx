"use client";

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { DataSourceLabel } from '@/components/ui/DataSourceLabel'
import React, { memo, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChartSkeleton } from "@/components/ui/Skeleton";
import type { FootballDataMatchEvent } from "@/types/TypesBarrel";

interface ShotPoint {
  teamId: number | null;
  x: number;
  y: number;
  xG: number | null;
  outcome: string;
  player: string;
  playerId: number;
  minute: number;
  technique?: string;
  bodyPart?: string;
  isGoal: boolean;
}

interface ShotMapApiResponse {
  available: boolean;
  shots: ShotPoint[];
  source: string;
  matchId: number;
  xgModel?: { name: string; source: string } | null;
  form?: { homeMatches: number; awayMatches: number } | null;
}

interface ShotMapProps {
  matchId: string | number;
  homeTeam: { id: number; name: string; shortName?: string };
  awayTeam: { id: number; name: string; shortName?: string };
  /** Legacy prop — ignored when StatsBomb data is available */
  events?: FootballDataMatchEvent[];
}

export const ShotMap = memo(function ShotMap({
  matchId,
  homeTeam,
  awayTeam,
  events = [],
}: ShotMapProps) {
  const t = useTranslations('Match')
  // Fetch StatsBomb shot data from the new /api/matches/[id]/shots route
  const { data: sbData, isLoading } = useQuery<ShotMapApiResponse>({
    queryKey: ["match-shots", matchId],
    queryFn: async () => {
      const res = await fetch(`/api/matches/${matchId}/shots`);
      if (!res.ok) throw new Error("Failed to fetch shot data");
      return res.json();
    },
    staleTime: 30 * 60 * 1000, // 30 min
  });

  // Fallback: map legacy events prop to ShotPoint shape
  const fallbackShots = useMemo(
    () =>
      events
        .filter(
          (e) =>
            e.analyticsSource === "REAL" &&
            (e.type === "SHOT" ||
              e.type === "GOAL" ||
              e.type === "PENALTY_GOAL" ||
              e.eventType === "goal") &&
            e.x != null &&
            e.y != null,
        )
        .map((e, i) => ({
          x: typeof e.x === "number" && e.x > 1 ? e.x : (e.x ?? 0.5) * 100,
          y: typeof e.y === "number" && e.y > 1 ? e.y : (e.y ?? 0.5) * 100,
          xG: null,
          teamId: e.team?.id ?? null,
          outcome:
            e.type === "GOAL" || e.eventType === "goal" ? "Goal" : "Saved",
          player: e.scorer?.name ?? e.player?.name ?? "Unknown",
          playerId: e.scorer?.id ?? e.player?.id ?? i,
          minute: e.minute ?? 0,
          isGoal:
            e.type === "GOAL" ||
            e.type === "PENALTY_GOAL" ||
            e.eventType === "goal",
        })),
    [events],
  );

  if (isLoading) return <ChartSkeleton className="h-96" />

  const shots: ShotPoint[] = sbData?.available ? sbData.shots : fallbackShots;

  if (shots.length === 0) {
    return (
      <div className="bg-card p-6 rounded-2xl border text-center text-muted-foreground">
        <p className="text-sm">
          {t('unavailableShots')}
        </p>
      </div>
    );
  }

  const homeShots = shots.filter(({ teamId }) => teamId === homeTeam.id);
  const awayShots = shots.filter(({ teamId }) => teamId === awayTeam.id);

  const total = (points: ShotPoint[]) => {
    const predictions = points.filter((shot) => shot.xG !== null)
    return predictions.length === points.length && points.length ? predictions.reduce((sum, shot) => sum + (shot.xG ?? 0), 0).toFixed(2) : '—'
  }
  const totalXg = { home: total(homeShots), away: total(awayShots) }
  const goalsCount = { home: homeShots.filter((shot) => shot.isGoal).length, away: awayShots.filter((shot) => shot.isGoal).length }

  return (
    <div className="bg-card rounded-2xl border p-6 space-y-4">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-6 bg-primary rounded-full" />
            <h3 className="text-lg font-bold">{t('shotMap')}</h3>
            <DataSourceLabel
              kind="real"
              detail={sbData?.available ? 'StatsBomb Open Data' : undefined}
            />
          </div>
          {sbData?.xgModel && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <DataSourceLabel kind="model" detail={sbData.xgModel.name} />
              <a href={sbData.xgModel.source} className="inline-flex items-center rounded bg-white px-2 py-1" rel="noreferrer">
                <Image src="/statsbomb-attribution.png" alt="StatsBomb Open Data" width={88} height={14} className="h-auto w-[88px]" />
              </a>
            </div>
          )}
          {sbData?.form && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t('xgFormCoverage', { home: sbData.form.homeMatches, away: sbData.form.awayMatches })}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">
            {sbData?.available
              ? `StatsBomb open data · ${shots.length} shots`
              : `${shots.length} shots from match events`}
          </p>
        </div>

        {/* xG Summary */}
        <div className="flex gap-6 text-center text-sm">
          <div>
            <div className="text-xs text-muted-foreground">
              {homeTeam.shortName || homeTeam.name}
            </div>
            <div className="font-bold text-blue-400">{totalXg.home} xG</div>
            <div className="text-xs text-muted-foreground">
              {goalsCount.home}G
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">
              {awayTeam.shortName || awayTeam.name}
            </div>
            <div className="font-bold text-red-400">{totalXg.away} xG</div>
            <div className="text-xs text-muted-foreground">
              {goalsCount.away}G
            </div>
          </div>
        </div>
      </div>

      {/* Team labels */}
      <div className="flex justify-between text-sm font-semibold">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span>{homeTeam.shortName || homeTeam.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span>{awayTeam.shortName || awayTeam.name}</span>
        </div>
      </div>

      {/* Pitch */}
      <div className="relative w-full aspect-[2/1] bg-green-700/90 rounded-lg overflow-hidden border-2 border-white/80 shadow-inner">
        {/* Pitch Markings */}
        <div className="absolute top-0 bottom-0 left-1/2 w-0 border-l-2 border-white/60" />
        <div className="absolute top-1/2 left-1/2 w-[20%] aspect-square -translate-x-1/2 -translate-y-1/2 border-2 border-white/60 rounded-full" />
        <div className="absolute top-1/2 left-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 bg-white/60 rounded-full" />
        {/* Penalty Areas */}
        <div className="absolute top-[20%] bottom-[20%] left-0 w-[16%] border-2 border-white/60 border-l-0" />
        <div className="absolute top-[20%] bottom-[20%] right-0 w-[16%] border-2 border-white/60 border-r-0" />
        {/* 6 Yard Boxes */}
        <div className="absolute top-[35%] bottom-[35%] left-0 w-[5%] border-2 border-white/60 border-l-0" />
        <div className="absolute top-[35%] bottom-[35%] right-0 w-[5%] border-2 border-white/60 border-r-0" />
        {/* Penalty Spots */}
        <div className="absolute top-1/2 left-[11%] w-1.5 h-1.5 -translate-y-1/2 bg-white/60 rounded-full" />
        <div className="absolute top-1/2 right-[11%] w-1.5 h-1.5 -translate-y-1/2 bg-white/60 rounded-full" />

        {/* Render shots — StatsBomb coords: x=0–100% left=home attack right */}
        {shots.map((shot, i) => {
          // StatsBomb: x along pitch (0=home goal, 100=away goal), y = width
          // We show home shots attacking right (high x), away attacking left
          const isHome = shot.teamId === homeTeam.id;
          const isAway = shot.teamId === awayTeam.id;
          // Normalize x to [0,1], flipping for away team
          const nx = shot.x / 100;
          const ny = shot.y / 100;
          const displayX = isAway ? 1 - nx : nx;
          const displayY = isAway ? 1 - ny : ny;
          const size = Math.max(7, Math.min(28, (shot.xG ?? 0) * 40 + 7));

          return (
            <div
              key={i}
              title={`${shot.minute}' – ${shot.player} · ${shot.outcome} · xG: ${shot.xG?.toFixed(3) ?? '—'}${shot.technique ? ` · ${shot.technique}` : ""}`}
              className={`absolute rounded-full transform -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-150 cursor-crosshair
                ${isHome ? "bg-blue-500" : isAway ? "bg-red-500" : "bg-neutral-400"}
                ${shot.isGoal ? "border-[3px] border-white z-10 shadow-lg" : "opacity-70 border border-black/20"}
              `}
              style={{
                left: `${displayX * 100}%`,
                top: `${displayY * 100}%`,
                width: `${size}px`,
                height: `${size}px`,
              }}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="text-xs text-muted-foreground flex gap-6 justify-center flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-neutral-400 opacity-70 border border-black/20" />
          <span>{t('shot')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-neutral-400 border-[3px] border-white ring-1 ring-black/20" />
          <span>{t('goal')}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
          <div className="w-3 h-3 rounded-full bg-neutral-400" />
          <div className="w-5 h-5 rounded-full bg-neutral-400" />
          <span className="ml-1">{t('sizeXg')}</span>
        </div>
      </div>
    </div>
  );
});
