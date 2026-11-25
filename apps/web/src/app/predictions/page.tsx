"use client";

import { useSession } from 'next-auth/react'
import { loginLink } from '@/lib/login-link'
import { useTranslations } from 'next-intl'
import { DataSourceLabel } from '@/components/ui/DataSourceLabel'
import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/grid";
import { useQuery } from "@tanstack/react-query";
import { PageSkeleton } from "@/components/ui/Skeleton";

interface TeamPrediction {
  teamId: number;
  name: string;
  shortName: string;
  crest: string | null;
  currentPosition: number;
  predictedPosition: number;
  currentPoints: number;
  currentPlayed: number;
  currentGD: number;
  avgPoints: number;
  titleProb: number;
  topFourProb: number;
  relegationProb: number;
}

interface SeasonPrediction {
  competition: string;
  season: number;
  source: string;
  simulations: number;
  matchesPlayed: number;
  matchesRemaining: number;
  leagueAvgHomeGoals: number;
  leagueAvgAwayGoals: number;
  formHalfLifeDays: number;
  strengthPriorMatches: number;
  teams: TeamPrediction[];
}

function getErrorStatus(error: unknown): number | undefined {
  return typeof error === 'object' && error !== null && 'status' in error &&
    typeof error.status === 'number' ? error.status : undefined
}

async function fetchSeasonPrediction(): Promise<SeasonPrediction> {
  const res = await fetch("/api/predictions/season");
  if (!res.ok) {
    // Propagate the error body so the UI can show a specific message
    const body = await res.json().catch(() => ({}));
    const err = new Error(
      body?.error ?? "Failed to fetch predictions",
    ) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function ProbBar({
  value,
  color,
}: {
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-2.5 rounded-full transition-all duration-1000 ${color}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        ></div>
      </div>
      <span className="text-xs font-mono font-semibold w-14 text-right whitespace-nowrap">
        {value}%
      </span>
    </div>
  );
}

export default function PredictionsPage() {
  const t = useTranslations('Forecast')
  const common = useTranslations('Common')
  const { data: session, status } = useSession()
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["season-prediction", session?.user.id],
    enabled: status === "authenticated",
    queryFn: fetchSeasonPrediction,
    staleTime: 1000 * 60 * 10, // cache 10 min
    retry: false,
  });

  if (status === "loading" || isLoading) return <PageSkeleton variant="table" />;
  if (status === "unauthenticated" || getErrorStatus(error) === 401) {
    return (
      <Container className="space-y-4 py-10">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <Link className="text-primary hover:underline" href={loginLink('/predictions')}>{common('signIn')}</Link>
      </Container>
    );
  }

  // No finished matches yet — show a helpful empty state instead of a generic error
  if (isError) {
    const status = getErrorStatus(error);
    const isNoData = status === 400;
    const isProviderUnavailable = status === 502;

    return (
      <Container className="py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <span className="text-4xl">🔮</span> {t('title')}
          </h1>
        </div>
        <div className="flex flex-col items-center justify-center text-center py-20 bg-card rounded-2xl border">
          <span className="text-5xl mb-6">{isNoData ? "📊" : "⚠️"}</span>
          <h2 className="text-xl font-bold mb-3">
            {isNoData ? t('insufficient') : t('unavailable')}
          </h2>
          <p className="text-muted-foreground max-w-md text-sm">
            {isNoData
              ? t('noResults')
              : isProviderUnavailable
                ? t('providerError')
                : t('error')}
          </p>
        </div>
      </Container>
    );
  }

  if (!data) return null;

  return (
    <Container className="py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <span className="text-4xl">🔮</span> {t('competition', { competition: data.competition })}
        </h1>
        <p className="text-muted-foreground">
          {t('overview', {
            season: `${data.season}/${String(data.season + 1).slice(-2)}`,
            matches: data.matchesRemaining,
            runs: data.simulations,
          })}
        </p>
      </div>

      {/* Model Info */}
      <div className="bg-card p-5 rounded-2xl border mb-8 flex flex-wrap gap-6 text-sm">
        <div>
          <span className="text-muted-foreground">{t('played')}</span>{" "}
          <span className="font-bold">{data.matchesPlayed}</span>
        </div>
        <div>
          <span className="text-muted-foreground">
            {t('homeGoals')}
          </span>{" "}
          <span className="font-bold">{data.leagueAvgHomeGoals}</span>
        </div>
        <div>
          <span className="text-muted-foreground">
            {t('awayGoals')}
          </span>{" "}
          <span className="font-bold">{data.leagueAvgAwayGoals}</span>
        </div>
        <div>
          <span className="text-muted-foreground">{t('model')}</span>{" "}
          <span className="font-bold">{t('poisson')}</span>
        </div>
        <div className="w-full text-xs text-muted-foreground">
          <DataSourceLabel kind="real" detail="Football-data.org" />
          <DataSourceLabel kind="model" detail="Poisson" className="ml-2" />
        </div>
      </div>

      <details className="mb-8 rounded-2xl border bg-card px-5 py-4">
        <summary className="cursor-pointer font-semibold">
          {t('how')}
        </summary>
        <dl className="mt-4 grid gap-4 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="font-semibold text-foreground">{t('position')}</dt>
            <dd>
              {t('positionExplanation')}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">{t('record')}</dt>
            <dd>
              {t('recordExplanation')}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">
              {t('predicted')}
            </dt>
            <dd>
              {t('predictedExplanation')}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">
              🏆 {t('titleAndTopFour')}
            </dt>
            <dd>
              {t('titleExplanation')}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">⬇️ {t('relegation')}</dt>
            <dd>
              {t('relegationExplanation')}
            </dd>
          </div>
        </dl>
      </details>

      {/* Predicted Standings Table */}
      <div className="bg-card rounded-2xl border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground uppercase text-xs tracking-wider">
                <th
                  className="text-left p-4 w-12"
                  title="Real current position"
                >
                  {t('position')}
                </th>
                <th className="text-left p-4">{t('team')}</th>
                <th className="text-center p-4" title="Matches Played">
                  {t('matchesColumn')}
                </th>
                <th className="text-center p-4" title="Current Points">
                  {t('pointsColumn')}
                </th>
                <th className="text-center p-4" title="Goal Difference">
                  {t('goalDiffColumn')}
                </th>
                <th
                  className="text-center p-4"
                  title="Average finishing position across simulations"
                >
                  {t('forecastPosition')}
                </th>
                <th
                  className="text-center p-4 hidden md:table-cell"
                  title="Predicted Avg Points"
                >
                  {t('forecastPoints')}
                </th>
                <th className="p-4 w-36" title="Title Probability">
                  <div className="flex items-center gap-1">🏆 {t('champion')}</div>
                </th>
                <th
                  className="p-4 w-36"
                  title="Top 4 (Champions League) Probability"
                >
                  <div className="flex items-center gap-1">⭐ {t('topFour')}</div>
                </th>
                <th className="p-4 w-36" title="Relegation Probability">
                  <div className="flex items-center gap-1">⬇️ {t('relegation')}</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.teams.map((team) => (
                <tr
                  key={team.teamId}
                  className={`hover:bg-muted/30 transition-colors ${
                    team.currentPosition === 1
                      ? "bg-yellow-500/5"
                      : team.currentPosition <= 4
                        ? "bg-blue-500/5"
                        : team.currentPosition > data.teams.length - 3
                          ? "bg-red-500/5"
                          : ""
                  }`}
                >
                  <td className="p-4 font-bold text-muted-foreground">
                    {team.currentPosition}
                  </td>
                  <td className="p-4">
                    <Link
                      href={`/teams/${team.teamId}`}
                      className="flex items-center gap-3 hover:text-primary transition-colors"
                    >
                      {team.crest && (
                        <Image
                          src={team.crest}
                          alt={team.name}
                          width={24}
                          height={24}
                          className="object-contain"
                        />
                      )}
                      <span className="font-semibold hidden md:inline">
                        {team.name}
                      </span>
                      <span className="font-semibold md:hidden">
                        {team.shortName}
                      </span>
                    </Link>
                  </td>
                  <td className="p-4 text-center tabular-nums">
                    {team.currentPlayed}
                  </td>
                  <td className="p-4 text-center font-bold tabular-nums">
                    {team.currentPoints}
                  </td>
                  <td className="p-4 text-center tabular-nums">
                    <span
                      className={
                        team.currentGD > 0
                          ? "text-green-500"
                          : team.currentGD < 0
                            ? "text-red-500"
                            : ""
                      }
                    >
                      {team.currentGD > 0 ? "+" : ""}
                      {team.currentGD}
                    </span>
                  </td>
                  <td className="p-4 text-center font-semibold tabular-nums">
                    {team.predictedPosition}
                  </td>
                  <td className="p-4 text-center font-bold tabular-nums hidden md:table-cell text-primary">
                    {team.avgPoints}
                  </td>
                  <td className="p-4">
                    <ProbBar
                      value={team.titleProb}
                      color="bg-yellow-500"
                    />
                  </td>
                  <td className="p-4">
                    <ProbBar
                      value={team.topFourProb}
                      color="bg-blue-500"
                    />
                  </td>
                  <td className="p-4">
                    <ProbBar
                      value={team.relegationProb}
                      color="bg-red-500"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <section className="mt-8 rounded-2xl border bg-card p-5 sm:p-6">
        <h2 className="text-lg font-bold">
          How the model calculates probabilities
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The current position and points come from real completed matches.
          Forecasts use this season&apos;s results and remaining fixtures from
          Football-data.org.
        </p>
        <ol className="mt-5 grid gap-5 text-sm text-muted-foreground lg:grid-cols-2">
          <li>
            <h3 className="font-semibold text-foreground">
              1. Give recent matches more weight
            </h3>
            <p className="mt-1">
              Each completed match gets weight{" "}
              <code className="rounded bg-muted px-1 py-0.5">
                2^(-days ago / {data.formHalfLifeDays})
              </code>
              . A match from {data.formHalfLifeDays} days ago counts half as
              much as a match today. Team attack and goals-conceded rates are
              calculated separately for home and away matches.
            </p>
          </li>
          <li>
            <h3 className="font-semibold text-foreground">
              2. Avoid overreacting to a few matches
            </h3>
            <p className="mt-1">
              Recent weighted goals per match are blended with the league
              average using a prior of {data.strengthPriorMatches} matches. This
              pulls estimates toward average when a team has little history,
              then the blended rate is divided by the matching league goal
              average to get its attack or defense strength.
            </p>
            <code className="mt-2 block overflow-x-auto rounded bg-muted p-2 text-xs text-foreground">
              team rate = (Σ(weight × goals) + 3 × league avg) / (Σ weight + 3)
            </code>
            <code className="mt-2 block overflow-x-auto rounded bg-muted p-2 text-xs text-foreground">
              attack/defense strength = team rate / league rate
            </code>
          </li>
          <li>
            <h3 className="font-semibold text-foreground">
              3. Estimate each fixture&apos;s goals
            </h3>
            <p className="mt-1">
              Expected home goals = league home-goal average × home attack
              strength × away defense strength. Expected away goals use the
              away-goal average × away attack strength × home defense strength.
              Each team&apos;s score is independently sampled from a Poisson
              distribution using that expected-goal value.
            </p>
            <code className="mt-2 block overflow-x-auto rounded bg-muted p-2 text-xs text-foreground">
              λhome = home avg × home attack × away defense
              <br />
              λaway = away avg × away attack × home defense
            </code>
            <code className="mt-2 block overflow-x-auto rounded bg-muted p-2 text-xs text-foreground">
              P(goals = k) = e^-λ × λ^k / k!
            </code>
          </li>
          <li>
            <h3 className="font-semibold text-foreground">
              4. Repeat the season simulation
            </h3>
            <p className="mt-1">
              The model simulates all {data.matchesRemaining} remaining matches{" "}
              {data.simulations.toLocaleString()} times, adds simulated results
              to real points and goal difference, and ranks teams by points,
              goal difference, then goals scored.
            </p>
            <p className="mt-2">
              Title % = simulations finishing 1st ÷ total simulations. Top 4 % =
              simulations finishing in positions 1–4 ÷ total simulations. These
              are model estimates, not guarantees.
            </p>
          </li>
        </ol>
        <p className="mt-5 border-t pt-4 text-xs text-muted-foreground">
          The model uses results and fixtures only; it does not account for
          injuries, lineups, transfers, or other news. Probabilities can change
          as new results arrive.
        </p>
      </section>
    </Container>
  );
}
