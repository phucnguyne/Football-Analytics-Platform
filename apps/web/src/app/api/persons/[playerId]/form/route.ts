import { NextRequest, NextResponse } from "next/server";
import prisma from "@app/database/src/client";
import {
  getPlayerMatches,
  resolveApiFootballPlayerId,
} from "@/lib/api-football";
import { readStatsBombEvents } from "@/lib/statsbomb";

function unavailableResponse() {
  return NextResponse.json({
    matches: [],
    summary: {
      avgRating: 0,
      trend: "STABLE",
      formBadge: "Match-by-match data unavailable",
      last5Rating: 0,
      totalGoalsLast5: 0,
      totalAssistsLast5: 0,
    },
    source: "unavailable",
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ playerId: string }> },
) {
  const id = Number((await params).playerId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  try {
    const player = await prisma.player.findUnique({ where: { id } });
    if (!player)
      return NextResponse.json({ error: "player not found" }, { status: 404 });

    const apiPlayerId = await resolveApiFootballPlayerId(
      player.id,
      player.name,
    );
    if (apiPlayerId) {
      const providerMatches = await getPlayerMatches(apiPlayerId);
      if (providerMatches.length > 0) {
        const matches = providerMatches.slice(-10).map((match, index) => {
          const home = match.teams?.home;
          const away = match.teams?.away;
          const winner = home?.winner ? home.id : away?.winner ? away.id : null;
          const isHome = true;
          const goals = match.goals?.total ?? 0;
          const rating = Number(match.rating ?? 0) || 0;
          return {
            matchId: match.fixture?.id ?? index,
            date:
              match.fixture?.date?.split("T")[0] ??
              new Date().toISOString().split("T")[0],
            opponent: {
              id: away?.id ?? 0,
              name: away?.name ?? "Opponent",
              shortName: away?.name ?? "Opponent",
            },
            isHome,
            result: winner == null ? "D" : winner === home?.id ? "W" : "L",
            score: `${goals} - 0`,
            minutes: match.minutes ?? 0,
            rating,
            goals,
            assists: match.goals?.assists ?? 0,
            xG: 0,
            xA: 0,
            keyPasses: match.passes?.key ?? 0,
            tackles: match.tackles?.total ?? 0,
          };
        });
        const rated = matches.filter((match) => match.rating > 0);
        const average =
          rated.length > 0
            ? rated.reduce((sum, match) => sum + match.rating, 0) / rated.length
            : 0;
        const last5 = matches.slice(-5);
        return NextResponse.json({
          matches,
          summary: {
            avgRating: +average.toFixed(2),
            trend: "STABLE",
            formBadge: "API-Football match data",
            last5Rating: +(
              last5.reduce((sum, match) => sum + match.rating, 0) /
              Math.max(1, last5.length)
            ).toFixed(2),
            totalGoalsLast5: last5.reduce((sum, match) => sum + match.goals, 0),
            totalAssistsLast5: last5.reduce(
              (sum, match) => sum + match.assists,
              0,
            ),
          },
          source: "api-football",
        });
      }
    }

    const lineupRows = await prisma.matchLineup.findMany({
      where: { playerId: id },
      select: { matchId: true, teamId: true, isStarter: true },
      orderBy: { match: { utcDate: "desc" } },
      take: 10,
    });
    if (lineupRows.length === 0) return unavailableResponse();

    const matches = await prisma.match.findMany({
      where: { id: { in: lineupRows.map((row) => row.matchId) } },
      include: { homeTeam: true, awayTeam: true, score: true },
    });
    const matchesById = new Map(matches.map((match) => [match.id, match]));
    const eventSets = await Promise.all(
      lineupRows.map(
        async (lineup) =>
          [lineup, await readStatsBombEvents(lineup.matchId)] as const,
      ),
    );

    const formMatches = eventSets.flatMap(([lineup, events]) => {
      const match = matchesById.get(lineup.matchId);
      if (!match || events.length === 0) return [];

      const playerEvents = events.filter((event) => event.player?.id === id);
      const shots = playerEvents.filter((event) => event.type?.name === "Shot");
      const goals = shots.filter(
        (event) => event.shot?.outcome?.name === "Goal",
      ).length;
      const assists = playerEvents.filter(
        (event) => event.pass?.goal_assist,
      ).length;
      const completedPasses = playerEvents.filter(
        (event) => event.type?.name === "Pass" && !event.pass?.outcome,
      ).length;
      const keyPasses = playerEvents.filter(
        (event) => event.type?.name === "Pass" && event.pass?.recipient,
      ).length;
      const tackles = playerEvents.filter((event) =>
        ["Tackle", "Interception"].includes(event.type?.name ?? ""),
      ).length;
      const xG = shots.reduce(
        (sum, event) => sum + (event.shot?.statsbomb_xg ?? 0),
        0,
      );
      const minutes = lineup.isStarter ? 90 : 30;
      const rating = Math.min(
        10,
        Math.max(
          1,
          6 +
            goals * 1.2 +
            assists * 0.8 +
            xG * 0.6 +
            completedPasses * 0.02 +
            tackles * 0.05 -
            (minutes < 60 ? 0.3 : 0),
        ),
      );
      const isHome = lineup.teamId === match.homeTeamId;
      const homeGoals = match.score?.homeTeamGoals ?? 0;
      const awayGoals = match.score?.awayTeamGoals ?? 0;

      return [
        {
          matchId: match.id,
          date: match.utcDate.toISOString().split("T")[0],
          opponent: {
            id: isHome ? match.awayTeam.id : match.homeTeam.id,
            name: isHome ? match.awayTeam.name : match.homeTeam.name,
            shortName: isHome
              ? match.awayTeam.shortName
              : match.homeTeam.shortName,
            crest: isHome
              ? (match.awayTeam.crest ?? undefined)
              : (match.homeTeam.crest ?? undefined),
          },
          isHome,
          result:
            homeGoals === awayGoals
              ? "D"
              : (isHome ? homeGoals > awayGoals : awayGoals > homeGoals)
                ? "W"
                : "L",
          score: `${homeGoals} - ${awayGoals}`,
          minutes,
          rating: +rating.toFixed(1),
          goals,
          assists,
          xG: +xG.toFixed(2),
          xA: 0,
          keyPasses,
          tackles,
        },
      ];
    });

    if (formMatches.length === 0) return unavailableResponse();
    const last5 = formMatches.slice(-5);
    const avgRating =
      formMatches.reduce((sum, match) => sum + match.rating, 0) /
      formMatches.length;
    const firstRating = formMatches[0].rating;
    const lastRating = formMatches[formMatches.length - 1].rating;

    return NextResponse.json({
      matches: formMatches,
      summary: {
        avgRating: +avgRating.toFixed(2),
        trend:
          lastRating > firstRating + 0.2
            ? "UP"
            : lastRating < firstRating - 0.2
              ? "DOWN"
              : "STABLE",
        formBadge: "StatsBomb event data",
        last5Rating: +(
          last5.reduce((sum, match) => sum + match.rating, 0) / last5.length
        ).toFixed(2),
        totalGoalsLast5: last5.reduce((sum, match) => sum + match.goals, 0),
        totalAssistsLast5: last5.reduce((sum, match) => sum + match.assists, 0),
      },
      source: "statsbomb-open-data",
    });
  } catch (error) {
    console.error("Error fetching player form:", error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
