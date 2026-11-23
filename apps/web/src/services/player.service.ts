import "server-only";
import prisma from "@app/database/src/client";
import { escapeSearchTerm } from "@/lib/search";
import { env } from "@/lib/env";
import {
  apiFootballPlayerNameMatches,
  getApiFootballTeamSquad,
} from "@/lib/api-football";
import type { FootballDataTeam, FootballDataTeamDetail } from "@/types/TypesBarrel";

type PlayerSearchHit = {
  id: number;
  name: string;
  position: string;
  shirtNumber: number | null;
  photo: string | null;
  team: Pick<FootballDataTeam, "id" | "name" | "shortName" | "crest"> | null;
};

type PlayerSearchResult =
  | { data: { players: PlayerSearchHit[]; error?: never }; cache: "short" | "standard"; status?: never }
  | { data: { error: string; players?: never }; cache?: never; status: number };

async function fetchOfficialTeam(teamId: number) {
  try {
    const response = await fetch(`${env.FOOTBALL_DATA_API_URL}/teams/${teamId}`, {
      redirect: "error",
      headers: { "X-Auth-Token": env.FOOTBALL_DATA_API_KEY },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5000),
    });
    return {
      team: response.ok ? (await response.json() as FootballDataTeamDetail) : null,
      status: response.status,
    };
  } catch {
    return { team: null, status: 503 };
  }
}

async function searchTeamPlayers(teamId: number, query: string, limit: number): Promise<PlayerSearchResult> {
  const [localTeam, official] = await Promise.all([
    prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, name: true, shortName: true, crest: true },
    }),
    fetchOfficialTeam(teamId),
  ]);

  const localRoster = localTeam ? await prisma.player.findMany({
    where: { teams: { some: { teamId } } },
    select: { id: true, name: true, position: true, shirtNumber: true, photo: true },
    orderBy: { name: "asc" },
  }) : [];
  const localById = new Map(localRoster.map((player) => [player.id, player]));
  const squad = official.team?.squad;
  const players = official.team?.players;
  const officialRoster = (Array.isArray(squad) && squad.length ? squad : Array.isArray(players) ? players : [])
    .filter((player) => Number.isInteger(player.id) && player.id > 0 && player.name?.trim());
  // Seeded placeholder names should not be shown as a real roster.
  const knownPlayers = localRoster.filter((player) => !/\b(Goalkeeper|Defender|Midfielder|Forward)\s+\d+$/i.test(player.name));
  const roster = officialRoster.length ? officialRoster : knownPlayers;
  const team = official.team ?? localTeam;

  if (!team || (roster.length === 0 && official.status !== 200 && official.status !== 404)) {
    return {
      data: { error: "Could not load this team roster from the football data provider" },
      status: official.status === 404 ? 404 : 503,
    };
  }

  const queryLower = query.toLocaleLowerCase();
  const visible = roster.filter((player) => player.name.toLocaleLowerCase().includes(queryLower)).slice(0, limit);
  if (!visible.length) return { data: { players: [] }, cache: "short" };

  const apiSquad = await getApiFootballTeamSquad(team.name, AbortSignal.timeout(3000)).catch(() => null);
  // IDs from API-Football are in a different namespace. Only use unambiguous
  // name matches to enrich players who already have a profile-compatible ID.
  const profiles = new Map<number, NonNullable<typeof apiSquad>>();
  for (const apiPlayer of apiSquad ?? []) {
    const matches = roster.filter((player) => apiFootballPlayerNameMatches(apiPlayer.name, player.name));
    if (matches.length !== 1) continue;
    const id = matches[0].id;
    const candidates = profiles.get(id) ?? [];
    candidates.push(apiPlayer);
    profiles.set(id, candidates);
  }

  return {
    data: {
      players: visible.map((player) => {
        const candidates = profiles.get(player.id);
        const apiPlayer = candidates?.length === 1 ? candidates[0] : null;
        const local = localById.get(player.id);
        return {
          id: player.id,
          name: player.name,
          position: apiPlayer?.position || player.position || local?.position || "",
          shirtNumber: apiPlayer?.number ?? player.shirtNumber ?? local?.shirtNumber ?? null,
          photo: apiPlayer?.photo ?? player.photo ?? local?.photo ?? null,
          team: { id: team.id, name: team.name, shortName: team.shortName, crest: team.crest },
        };
      }),
    },
    cache: officialRoster.length ? "standard" : "short",
  };
}

export async function searchPlayers({
  query,
  limit,
  teamId,
}: {
  query: string;
  limit: number;
  teamId?: number;
}): Promise<PlayerSearchResult> {
  if (teamId) return searchTeamPlayers(teamId, query, limit);

  const players = await prisma.player.findMany({
    where: query
      ? {
          name: {
            contains: escapeSearchTerm(query),
            mode: "insensitive",
          },
        }
      : undefined,
    select: {
      id: true,
      name: true,
      position: true,
      shirtNumber: true,
      photo: true,
      teams: {
        select: {
          team: {
            select: { id: true, name: true, shortName: true, crest: true },
          },
        },
      },
    },
    take: limit,
    orderBy: {
      name: "asc",
    },
  });

  const formatted = players.map((p) => ({
    id: p.id,
    name: p.name,
    position: p.position,
    shirtNumber: p.shirtNumber,
    photo: p.photo,
    team: p.teams[0]?.team
      ? {
          id: p.teams[0].team.id,
          name: p.teams[0].team.name,
          shortName: p.teams[0].team.shortName,
          crest: p.teams[0].team.crest,
        }
      : null,
  }));

  return { data: { players: formatted }, cache: "short" };
}
