import "server-only";
import prisma from "@app/database/src/client";
import { env } from "@/lib/env";
import {
  apiFootballPlayerNameMatches,
  getApiFootballTeamSquad,
} from "@/lib/api-football";
import type { FootballDataTeamDetail } from "@/types/TypesBarrel";

export async function searchPlayers({
  query,
  limit,
  teamId,
}: {
  query: string;
  limit: number;
  teamId?: number;
}) {
  if (teamId) {
    const localTeam = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, name: true, shortName: true, crest: true },
    });
    let providerData: FootballDataTeamDetail | null = null;
    let providerStatus: number | null = null;
    if (!localTeam) {
      const response = await fetch(
        `${env.FOOTBALL_DATA_API_URL}/teams/${teamId}`,
        {
          headers: { "X-Auth-Token": env.FOOTBALL_DATA_API_KEY },
          next: { revalidate: 3600 },
        },
      );
      if (response.ok) {
        providerData = (await response.json()) as FootballDataTeamDetail;
      } else {
        providerStatus = response.status;
      }
    }

    const teamName = localTeam?.name ?? providerData?.name;
    const apiSquad = teamName ? await getApiFootballTeamSquad(teamName) : null;

    if (apiSquad) {
      const localRoster = localTeam
        ? await prisma.player.findMany({
            where: { teams: { some: { teamId } } },
            select: {
              id: true,
              name: true,
              position: true,
              shirtNumber: true,
              photo: true,
              teams: {
                where: { teamId },
                select: {
                  team: {
                    select: {
                      id: true,
                      name: true,
                      shortName: true,
                      crest: true,
                    },
                  },
                },
              },
            },
          })
        : [];
      const providerRoster = providerData?.squad ?? providerData?.players ?? [];
      const candidateRoster =
        localRoster.length > 0 ? localRoster : providerRoster;
      const players = apiSquad
        .flatMap((apiPlayer) => {
          const matches = candidateRoster.filter(
            (player: { name?: string }) =>
              player.name &&
              apiFootballPlayerNameMatches(apiPlayer.name, player.name),
          );
          if (matches.length !== 1) return [];

          const player = matches[0];
          return [
            {
              id: player.id,
              name: player.name,
              position: apiPlayer.position || player.position,
              shirtNumber: apiPlayer.number ?? player.shirtNumber,
              photo: apiPlayer.photo ?? player.photo,
              team: localTeam
                ? {
                    id: localTeam.id,
                    name: localTeam.name,
                    shortName: localTeam.shortName,
                    crest: localTeam.crest,
                  }
                : providerData
                  ? {
                      id: providerData.id,
                      name: providerData.name,
                      shortName: providerData.shortName,
                      crest: providerData.crest,
                    }
                  : null,
            },
          ];
        })
        .filter((player) =>
          player.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
        )
        .slice(0, limit);

      if (players.length === 0) {
        return {
          data: {
            error: "Could not match this team squad to local player records",
          },
          status: 503,
        };
      }

      return { data: { players }, cache: "standard" as const };
    }

    if (!providerData) {
      const response = await fetch(
        `${env.FOOTBALL_DATA_API_URL}/teams/${teamId}`,
        {
          headers: { "X-Auth-Token": env.FOOTBALL_DATA_API_KEY },
          next: { revalidate: 3600 },
        },
      );
      if (response.ok) {
        providerData = (await response.json()) as FootballDataTeamDetail;
      }
    }

    if (providerData) {
      const roster = providerData.squad ?? providerData.players ?? [];
      if (roster.length > 0) {
        const normalizedQuery = query.toLocaleLowerCase();
        const players = roster
          .filter((player: { name?: string }) =>
            (player.name ?? "").toLocaleLowerCase().includes(normalizedQuery),
          )
          .slice(0, limit)
          .map((player) => ({
            id: player.id,
            name: player.name,
            position: player.position ?? "",
            shirtNumber: player.shirtNumber ?? null,
            photo: player.photo ?? null,
            team: {
              id: providerData.id,
              name: providerData.name,
              shortName: providerData.shortName,
              crest: providerData.crest,
            },
          }));

        return { data: { players }, cache: "short" as const };
      }
    }

    const roster = await prisma.player.findMany({
      where: { teams: { some: { teamId } } },
      select: {
        id: true,
        name: true,
        position: true,
        shirtNumber: true,
        photo: true,
        teams: {
          where: { teamId },
          select: {
            team: {
              select: { id: true, name: true, shortName: true, crest: true },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    if (roster.length > 0) {
      const normalizedQuery = query.toLocaleLowerCase();
      const players = roster
        .filter((player) =>
          player.name.toLocaleLowerCase().includes(normalizedQuery),
        )
        .slice(0, limit);

      return {
        data: {
          players: players.map((player) => ({
            id: player.id,
            name: player.name,
            position: player.position,
            shirtNumber: player.shirtNumber,
            photo: player.photo,
            team: player.teams[0]?.team
              ? {
                  id: player.teams[0].team.id,
                  name: player.teams[0].team.name,
                  shortName: player.teams[0].team.shortName,
                  crest: player.teams[0].team.crest,
                }
              : null,
          })),
        },
        cache: "short" as const,
      };
    }

    if (providerStatus !== null) {
      return {
        data: {
          error:
            "Could not load this team roster from the football data provider",
        },
        status: providerStatus,
      };
    }

    return { data: { players: [] } };
  }

  const players = await prisma.player.findMany({
    where: query
      ? {
          name: {
            contains: query,
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

  return { data: { players: formatted }, cache: "short" as const };
}
