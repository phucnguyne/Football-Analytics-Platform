"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/grid";
import { useQuery } from "@tanstack/react-query";
import { PageSpinner } from "@/components/ui/Spinner";

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
  label,
}: {
  value: number;
  color: string;
  label: string;
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
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["season-prediction"],
    queryFn: fetchSeasonPrediction,
    staleTime: 1000 * 60 * 10, // cache 10 min
    retry: false,
  });

  if (isLoading) return <PageSpinner />;

  // No finished matches yet — show a helpful empty state instead of a generic error
  if (isError) {
    const status = (error as any)?.status;
    const isNoData = status === 400;
    const isProviderUnavailable = status === 502;

    return (
      <Container className="py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <span className="text-4xl">🔮</span> Season Predictions
          </h1>
        </div>
        <div className="flex flex-col items-center justify-center text-center py-20 bg-card rounded-2xl border">
          <span className="text-5xl mb-6">{isNoData ? "📊" : "⚠️"}</span>
          <h2 className="text-xl font-bold mb-3">
            {isNoData ? "Not enough match data yet" : "Predictions unavailable"}
          </h2>
          <p className="text-muted-foreground max-w-md text-sm">
            {isNoData
              ? "Football-data.org has not returned any completed results for the current Premier League season yet."
              : isProviderUnavailable
                ? "Could not load current results and fixtures from Football-data.org. Please try again later."
                : "An unexpected error occurred while loading predictions. Please try again later."}
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
          <span className="text-4xl">🔮</span> {data.competition} Season
          Predictions
        </h1>
        <p className="text-muted-foreground">
          {data.season}/{String(data.season + 1).slice(-2)} season · Current
          positions use actual completed results. Forecasts simulate the{" "}
          {data.matchesRemaining} remaining matches (
          {data.simulations.toLocaleString()} runs).
        </p>
      </div>

      {/* Model Info */}
      <div className="bg-card p-5 rounded-2xl border mb-8 flex flex-wrap gap-6 text-sm">
        <div>
          <span className="text-muted-foreground">Real matches played:</span>{" "}
          <span className="font-bold">{data.matchesPlayed}</span>
        </div>
        <div>
          <span className="text-muted-foreground">
            Recent-weighted home goals:
          </span>{" "}
          <span className="font-bold">{data.leagueAvgHomeGoals}</span>
        </div>
        <div>
          <span className="text-muted-foreground">
            Recent-weighted away goals:
          </span>{" "}
          <span className="font-bold">{data.leagueAvgAwayGoals}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Model:</span>{" "}
          <span className="font-bold">Recent form + Poisson</span>
        </div>
        <div className="w-full text-xs text-muted-foreground">
          Source: {data.source}
        </div>
      </div>

      <details className="mb-8 rounded-2xl border bg-card px-5 py-4">
        <summary className="cursor-pointer font-semibold">
          How to read these predictions
        </summary>
        <dl className="mt-4 grid gap-4 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="font-semibold text-foreground"># and Team</dt>
            <dd>
              Real current league position calculated from completed matches:
              points, goal difference, then goals scored.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">P, Pts and GD</dt>
            <dd>
              Matches played, current points, and current goal difference from
              completed matches.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">
              Pred Pos and Pred Pts
            </dt>
            <dd>
              Average finishing position and average final points across all
              simulations. These are forecasts, not actual standings.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">
              🏆 Title and ⭐ Top 4
            </dt>
            <dd>
              Share of simulations in which a club finishes first or in the top
              four.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">⬇️ Releg.</dt>
            <dd>
              Share of simulations in which a club finishes in the bottom three.
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
                  # Real
                </th>
                <th className="text-left p-4">Team</th>
                <th className="text-center p-4" title="Matches Played">
                  P
                </th>
                <th className="text-center p-4" title="Current Points">
                  Pts
                </th>
                <th className="text-center p-4" title="Goal Difference">
                  GD
                </th>
                <th
                  className="text-center p-4"
                  title="Average finishing position across simulations"
                >
                  Pred Pos
                </th>
                <th
                  className="text-center p-4 hidden md:table-cell"
                  title="Predicted Avg Points"
                >
                  Pred Pts
                </th>
                <th className="p-4 w-36" title="Title Probability">
                  <div className="flex items-center gap-1">🏆 Title</div>
                </th>
                <th
                  className="p-4 w-36"
                  title="Top 4 (Champions League) Probability"
                >
                  <div className="flex items-center gap-1">⭐ Top 4</div>
                </th>
                <th className="p-4 w-36" title="Relegation Probability">
                  <div className="flex items-center gap-1">⬇️ Releg.</div>
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
                      label="Title"
                    />
                  </td>
                  <td className="p-4">
                    <ProbBar
                      value={team.topFourProb}
                      color="bg-blue-500"
                      label="Top 4"
                    />
                  </td>
                  <td className="p-4">
                    <ProbBar
                      value={team.relegationProb}
                      color="bg-red-500"
                      label="Relegation"
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
