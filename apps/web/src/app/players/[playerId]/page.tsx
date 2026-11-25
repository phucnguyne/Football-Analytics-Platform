"use client";

import { useTranslations } from "next-intl";
import { DataExport } from "@/components/ui/DataExport";
import { DataSourceLabel } from "@/components/ui/DataSourceLabel";
import { dataSourceFor } from "@/lib/data-source";
import { use } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Container } from "@/components/ui/grid";
import { ChartSkeleton, PageSkeleton } from "@/components/ui/Skeleton";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { PlayerHeatmapCard } from "@/components/players/PlayerHeatmapCard";
import { SimilarPlayersCard } from "@/components/players/SimilarPlayersCard";
import { PlayerCareerTimeline } from "@/components/players/PlayerCareerTimeline";
import { PlayerPhoto } from "@/components/players/PlayerPhoto";

const PlayerRadarChart = dynamic(
  () =>
    import("@/components/players/PlayerRadarChart").then((module) => ({
      default: module.PlayerRadarChart,
    })),
  { loading: () => <ChartSkeleton />, ssr: false },
);

const PlayerFormTrend = dynamic(
  () =>
    import("@/components/players/PlayerFormTrend").then((module) => ({
      default: module.PlayerFormTrend,
    })),
  { loading: () => <ChartSkeleton className="h-[480px]" />, ssr: false },
);

const PlayerComparisonDashboard = dynamic(
  () =>
    import("@/components/players/PlayerComparisonDashboard").then((module) => ({
      default: module.PlayerComparisonDashboard,
    })),
  { loading: () => <ChartSkeleton className="h-[640px]" />, ssr: false },
);

async function getPlayer(id: string) {
  const res = await fetch(`/api/persons/${id}`);
  if (!res.ok) throw new Error("Failed to fetch player");
  return res.json();
}

export default function PlayerDetailsPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const t = useTranslations('Player')
  const metric = useTranslations("Export");
  const common = useTranslations("Common");
  const { playerId } = use(params);

  const {
    data: player,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["player", playerId],
    queryFn: () => getPlayer(playerId),
    enabled: !!playerId,
    placeholderData: undefined,
  });

  if (isLoading) return <PageSkeleton variant="detail" />;
  if (isError || !player) return <ErrorMessage />;

  const stats = player.stats;
  const currentTeam = player.teams?.[0];

  return (
    <Container className="py-10">
      <Link
        href="/teams"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-6"
      >
        ← {common("backToTeams")}
      </Link>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Col: Player Profile Card */}
        <div className="space-y-6">
          <div className="bg-card p-6 rounded-2xl border shadow-sm relative overflow-hidden flex flex-col items-center text-center">
            <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />

            <PlayerPhoto
              playerId={player.id}
              name={player.name}
              photo={player.photo}
              className="relative z-10 mb-4 h-24 w-24 rounded-full border-4 border-background shadow-md"
            />

            <h1 className="text-3xl font-bold tracking-tight mb-1">
              {player.name}
            </h1>
            <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium mb-4 uppercase tracking-wider">
              {player.position?.replace("_", " ")}
            </div>

            {currentTeam && (
              <Link
                href={`/teams/${currentTeam.id}`}
                className="flex items-center gap-2 hover:bg-muted/50 p-2 rounded-lg transition-colors border"
              >
                {currentTeam.crest && (
                  <Image
                    src={currentTeam.crest}
                    alt={currentTeam.name}
                    width={24}
                    height={24}
                  />
                )}
                <span className="font-semibold text-sm">
                  {currentTeam.name}
                </span>
                {player.shirtNumber && (
                  <span className="text-muted-foreground border-l pl-2 text-xs">
                    #{player.shirtNumber}
                  </span>
                )}
              </Link>
            )}

            <div className="w-full grid grid-cols-2 gap-4 mt-6 text-sm">
              <div className="bg-muted/30 p-3 rounded-xl border border-transparent">
                <p className="text-muted-foreground text-xs uppercase mb-1">
                  {t('nationality')}
                </p>
                <p className="font-semibold">
                  {player.nationality || t('unknown')}
                </p>
              </div>
              <div className="bg-muted/30 p-3 rounded-xl border border-transparent">
                <p className="text-muted-foreground text-xs uppercase mb-1">
                  {t('age')}
                </p>
                <p className="font-semibold">
                  {player.dateOfBirth
                    ? `${new Date().getFullYear() - new Date(player.dateOfBirth).getFullYear()} yrs`
                    : t('unknown')}
                </p>
              </div>
            </div>
          </div>

          {/* Basic Stats Summary */}
          {stats ? (
            <div className="bg-card p-6 rounded-2xl border">
              <h3 className="text-lg font-bold mb-2">{t('seasonSummary')}{player.statsSeason ? ` · ${player.statsSeason}` : ''}</h3>
              <DataSourceLabel kind={dataSourceFor([stats.dataSource])} detail={player.statsSource === 'api-football' ? 'API-Football' : undefined} className="mb-4" />
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-muted/20 rounded-xl">
                  <p className="text-3xl font-black tabular-nums text-primary mb-1">
                    {stats.matchesPlayed ?? '—'}
                  </p>
                  <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">
                    {metric('matches')}
                  </p>
                </div>
                <div className="text-center p-4 bg-muted/20 rounded-xl">
                  <p className="text-3xl font-black tabular-nums text-primary mb-1">
                    {stats.goals ?? '—'}
                  </p>
                  <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">
                    {metric('goals')}
                  </p>
                </div>
                <div className="text-center p-4 bg-muted/20 rounded-xl">
                  <p className="text-3xl font-black tabular-nums text-primary mb-1">
                    {stats.assists ?? '—'}
                  </p>
                  <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">
                    {metric('assists')}
                  </p>
                </div>
                <div className="text-center p-4 bg-muted/20 rounded-xl">
                  <p className="text-3xl font-black tabular-nums text-primary mb-1">
                    {stats.minutesPlayed == null ? '—' : `${stats.minutesPlayed}′`}
                  </p>
                  <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">
                    {metric('minutes')}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2 rounded-2xl border bg-card p-6">
              <h3 className="text-lg font-bold">{t('seasonSummary')}</h3>
              <DataSourceLabel kind="unavailable" />
            </div>
          )}
        </div>

        {/* Right Col: Advanced Stats Radar & Details */}
        <div className="lg:col-span-2 space-y-6">
          <PlayerRadarChart
            playerStats={stats}
            positionalAverages={player.positionalAverages}
            playerName={player.name}
            position={player.position?.replace("_", " ") || t('unknown')}
          />

          <PlayerFormTrend playerId={player.id} />

          <PlayerCareerTimeline playerId={player.id} playerName={player.name} />

          <PlayerHeatmapCard player={player} />

          <SimilarPlayersCard
            playerId={player.id}
            playerTeamId={currentTeam?.id ?? player.currentTeam?.id}
          />

          {stats && (
            <div className="bg-card p-6 rounded-2xl border">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <span className="text-xl">📊</span> {t('detailed')}
              </h3>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <DataSourceLabel kind={dataSourceFor([stats.dataSource])} detail={player.statsSource === 'api-football' ? 'API-Football' : undefined} />
                <DataExport
                  filename={`player-${player.id}-statistics`}
                  title={metric("playerStats", { name: player.name })}
                  columns={[metric("metric"), metric("value")]}
                  rows={[
                    [metric("matches"), stats.matchesPlayed], [metric("goals"), stats.goals],
                    [metric("assists"), stats.assists], [metric("minutes"), stats.minutesPlayed],
                    [metric("xg"), stats.xG], [metric("xa"), stats.xA],
                    [metric("shotsPer90"), stats.shotsPer90], [metric("passAccuracy"), stats.passCompletion],
                    [metric("progressivePasses"), stats.progressivePasses], [metric("dribblesSuccess"), stats.dribblesSuccess],
                    [metric("tackles"), stats.tacklesPer90], [metric("interceptions"), stats.interceptions],
                    [metric("yellowCards"), stats.yellowCards], [metric("redCards"), stats.redCards],
                  ]}
                />
              </div>

              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 border-b pb-2">
                    {t('attacking')}
                  </h4>
                  <ul className="space-y-3">
                    <li className="flex justify-between items-center text-sm">
                      <span>{metric('xg')}</span>
                      <span className="font-bold tabular-nums">
                        {stats.xG?.toFixed(2) ?? '—'}
                      </span>
                    </li>
                    <li className="flex justify-between items-center text-sm">
                      <span>{metric('xa')}</span>
                      <span className="font-bold tabular-nums">
                        {stats.xA?.toFixed(2) ?? '—'}
                      </span>
                    </li>
                    <li className="flex justify-between items-center text-sm">
                      <span>{metric('shotsPer90')}</span>
                      <span className="font-bold tabular-nums">
                        {stats.shotsPer90?.toFixed(2) ?? '—'}
                      </span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 border-b pb-2">
                    {t('possession')}
                  </h4>
                  <ul className="space-y-3">
                    <li className="flex justify-between items-center text-sm">
                      <span>{metric('passAccuracy')}</span>
                      <span className="font-bold tabular-nums">
                        {stats.passCompletion == null ? '—' : `${stats.passCompletion.toFixed(1)}%`}
                      </span>
                    </li>
                    <li className="flex justify-between items-center text-sm">
                      <span>{metric('progressivePasses')}</span>
                      <span className="font-bold tabular-nums">
                        {stats.progressivePasses?.toFixed(1) ?? '—'}
                      </span>
                    </li>
                    <li className="flex justify-between items-center text-sm">
                      <span>{metric('dribblesSuccess')}</span>
                      <span className="font-bold tabular-nums">
                        {stats.dribblesSuccess == null ? '—' : `${stats.dribblesSuccess.toFixed(1)}%`}
                      </span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 border-b pb-2">
                    {t('defending')}
                  </h4>
                  <ul className="space-y-3">
                    <li className="flex justify-between items-center text-sm">
                      <span>{metric('tackles')}</span>
                      <span className="font-bold tabular-nums">
                        {stats.tacklesPer90?.toFixed(2) ?? '—'}
                      </span>
                    </li>
                    <li className="flex justify-between items-center text-sm">
                      <span>{metric('interceptions')}</span>
                      <span className="font-bold tabular-nums">
                        {stats.interceptions?.toFixed(2) ?? '—'}
                      </span>
                    </li>
                    <li className="flex justify-between items-center text-sm text-red-500">
                      <span>{t('cards')}</span>
                      <span className="font-bold tabular-nums">
                        {stats.yellowCards ?? '—'} / {stats.redCards ?? '—'}
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Head-to-Head Comparison Tool Section */}
      <div id="compare" className="mt-12">
        <PlayerComparisonDashboard initialPlayer1Id={player.id} />
      </div>
    </Container>
  );
}
