import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { env, getFootballDataEnv } from '@app/config'
import { Prisma, PrismaClient, type MatchStatus, type Winner, type Duration, type Position } from '@prisma/client'

interface ProviderPlayer {
  id: number
  name: string
  position?: string
  dateOfBirth?: string
  nationality?: string
  shirtNumber?: number
}

interface ProviderTeam {
  id: number
  name: string
  shortName?: string | null
  tla?: string | null
  crest?: string | null
  founded?: number | null
  venue?: string | null
  squad?: ProviderPlayer[]
}

interface ProviderScore {
  home?: number | null
  away?: number | null
}

type ProviderMatch = Prisma.InputJsonObject & {
  id: number
  utcDate: string
  status: string
  matchday?: number
  stage?: string
  minute?: number | null
  lastUpdated?: string
  homeTeam: { id: number }
  awayTeam: { id: number }
  score?: {
    winner?: string | null
    duration?: string | null
    fullTime?: ProviderScore
    halfTime?: ProviderScore
  }
}

interface ProviderStanding {
  team: { id: number }
  position: number
  playedGames: number
  won: number
  draw: number
  lost: number
  points: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
}

const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } })
const { FOOTBALL_DATA_API_KEY, FOOTBALL_DATA_API_URL } = getFootballDataEnv()
const competitionCode = process.argv.find((arg) => arg.startsWith('--competition='))?.slice('--competition='.length).toUpperCase() ?? 'PL'
const seasonOption = process.argv.find((arg) => arg.startsWith('--season='))?.slice('--season='.length)
const requestedYear = seasonOption === undefined ? undefined : Number(seasonOption)
const statusMap: Record<string, MatchStatus> = {
  SCHEDULED: 'SCHEDULED', TIMED: 'TIMED', IN_PLAY: 'IN_PLAY', PAUSED: 'PAUSED',
  FINISHED: 'FINISHED', POSTPONED: 'POSTPONED', CANCELLED: 'CANCELLED', SUSPENDED: 'SUSPENDED',
}

async function fetchApi<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${FOOTBALL_DATA_API_URL}${endpoint}`, {
    headers: { 'X-Auth-Token': FOOTBALL_DATA_API_KEY },
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error(`${endpoint}: HTTP ${response.status}`)
  return response.json()
}

function winner(value: string | null | undefined): Winner | null {
  return value === 'HOME_TEAM' ? 'HOME' : value === 'AWAY_TEAM' ? 'AWAY' : value === 'DRAW' ? 'DRAW' : null
}

function duration(value: string | null | undefined): Duration | null {
  return value === 'REGULAR' ? 'REGULAR' : value === 'EXTRA_TIME' ? 'EXTRA_TIME' : value === 'PENALTY_SHOOTOUT' ? 'PENALTY' : null
}

function playerPosition(value: string | undefined): Position | undefined {
  const position = value?.toLowerCase()
  if (position?.includes('keeper')) return 'GOALKEEPER'
  if (position && /defen[cd]|back/.test(position)) return 'DEFENDER'
  if (position?.includes('midfield')) return 'MIDFIELDER'
  if (position && /forward|offen[cs]|winger|striker/.test(position)) return 'FORWARD'
}

async function importSquads(teams: ProviderTeam[]): Promise<number> {
  const rosters = teams.flatMap((team) => (team.squad ?? []).flatMap((player) => {
    const position = playerPosition(player.position)
    if (!position || !Number.isSafeInteger(player.id) || player.id <= 0 || !player.name?.trim()) return []
    const date = player.dateOfBirth ? new Date(player.dateOfBirth) : null
    return [{
      teamId: team.id,
      player: { id: player.id, name: player.name, position, shirtNumber: player.shirtNumber,
        nationality: player.nationality, dateOfBirth: date && Number.isFinite(date.getTime()) ? date : null },
    }]
  }))
  if (!rosters.length) return 0

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(1725304)`
    const imported = [...new Map(rosters.map(({ player }) => [player.id, player])).values()]
    await tx.player.createMany({ data: imported, skipDuplicates: true })
    const persisted = await tx.player.findMany({
      where: { id: { in: imported.map(({ id }) => id) } },
      select: { id: true, name: true, teams: { select: { teamId: true } } },
    })
    const byId = new Map(persisted.map((player) => [player.id, player]))
    const members = new Set(persisted.flatMap(({ id, teams }) => teams.map(({ teamId }) => `${id}:${teamId}`)))
    const links = rosters.flatMap(({ teamId, player }) => {
      const key = `${player.id}:${teamId}`
      // Source IDs may overlap with historical feeds. Keep an existing player when identity differs.
      if (byId.get(player.id)?.name.toLowerCase() !== player.name.toLowerCase() || members.has(key)) return []
      members.add(key)
      return [{ playerId: player.id, teamId, shirtNumber: player.shirtNumber }]
    })
    if (links.length) await tx.playerTeam.createMany({ data: links })
    return links.length
  }, { timeout: 30000 })
}

async function syncCurrentSeason() {
  if (!/^[A-Z0-9]{2,10}$/.test(competitionCode)) throw new Error('Invalid competition code')
  const path = `/competitions/${competitionCode}`
  const competition = await fetchApi<{
    id: number
    name: string
    emblem?: string | null
    area?: { name?: string }
    currentSeason?: { startDate: string; endDate: string }
    seasons?: { startDate: string; endDate: string }[]
  }>(path)
  const currentYear = competition.currentSeason?.startDate.slice(0, 4)
  if (requestedYear !== undefined && (!Number.isInteger(requestedYear) || requestedYear < 1992)) {
    throw new Error('Use a four-digit season start year')
  }
  const sourceSeason = requestedYear === undefined || String(requestedYear) === currentYear
    ? competition.currentSeason
    : competition.seasons?.find((item) => item.startDate.slice(0, 4) === String(requestedYear))
  if (!sourceSeason) throw new Error(`No current season returned for ${competitionCode}`)
  const startDate = new Date(sourceSeason.startDate)
  const endDate = new Date(sourceSeason.endDate)
  const year = startDate.getUTCFullYear()
  if (!Number.isFinite(year) || !(endDate >= startDate)) throw new Error('Invalid provider season dates')

  const [teams, matches, standings] = await Promise.all([
    fetchApi<{ teams: ProviderTeam[] }>(`${path}/teams?season=${year}`),
    fetchApi<{ matches: ProviderMatch[] }>(`${path}/matches?season=${year}`),
    fetchApi<{ standings: { type: string; group?: string | null; table: ProviderStanding[] }[] }>(`${path}/standings?season=${year}`)
      .catch((error: Error) => {
        console.warn(`Standings import skipped (${error.message})`)
        return null
      }),
  ])
  if (!teams.teams?.length || !matches.matches?.length) throw new Error('Provider returned no teams or fixtures')
  const leagueData = { name: competition.name, country: competition.area?.name ?? 'Unknown', emblem: competition.emblem }
  const existingLeague = await prisma.league.findUnique({ where: { id: competition.id } })
    ?? await prisma.league.findUnique({ where: { name: competition.name } })
  const league = existingLeague
    ? await prisma.league.update({ where: { id: existingLeague.id }, data: leagueData })
    : await prisma.league.create({ data: { id: competition.id, ...leagueData } })
  const season = await prisma.season.upsert({
    where: { leagueId_year: { leagueId: league.id, year } },
    update: { startDate, endDate },
    create: { leagueId: league.id, year, startDate, endDate },
  })

  const teamIds = new Set<number>()
  for (const item of teams.teams) {
    const data = { name: item.name, shortName: item.shortName || item.tla || item.name,
      crest: item.crest, founded: item.founded, venue: item.venue }
    await prisma.team.upsert({ where: { id: item.id }, update: data, create: { id: item.id, ...data } })
    teamIds.add(item.id)
  }

  await prisma.teamSeason.createMany({
    data: [...teamIds].map((teamId) => ({ teamId, seasonId: season.id })),
    skipDuplicates: true,
  })
  const importingCurrentSeason = String(year) === currentYear
  const squadLinks = importingCurrentSeason ? await importSquads(teams.teams) : 0
  const fixtures = matches.matches.flatMap((item) => {
    const home = item.homeTeam?.id
    const away = item.awayTeam?.id
    const kickoff = new Date(item.utcDate)
    const status = statusMap[item.status]
    if (!teamIds.has(home) || !teamIds.has(away) || !Number.isFinite(kickoff.getTime()) || !status) return []
    const dateUpdated = item.lastUpdated ? new Date(item.lastUpdated) : null
    return [{
      id: item.id, home, away, status, kickoff: kickoff.toISOString(),
      matchday: item.matchday ?? null, stage: item.stage ?? null, minute: item.minute ?? null,
      updated: dateUpdated && Number.isFinite(dateUpdated.getTime()) ? dateUpdated.toISOString() : null,
      payload: item,
      score_id: randomUUID(), home_goals: item.score?.fullTime?.home ?? null, away_goals: item.score?.fullTime?.away ?? null,
      home_half: item.score?.halfTime?.home ?? null, away_half: item.score?.halfTime?.away ?? null,
      winner: winner(item.score?.winner), duration: duration(item.score?.duration),
    }]
  }).sort((a, b) => a.id - b.id)
  if (!fixtures.length) throw new Error('No valid fixtures returned by the provider')
  let matchCount = 0
  for (let index = 0; index < fixtures.length; index += 75) {
    const batch = fixtures.slice(index, index + 75)
    matchCount += await prisma.$transaction(async (tx) => {
      const updated = await tx.$queryRaw<{ id: number }[]>`
        INSERT INTO "matches" (id, "utcDate", status, matchday, stage, minute, "lastUpdated", "homeTeamId",
          "awayTeamId", "leagueId", "seasonId", "rawData", "updatedAt")
        SELECT item.id, item.kickoff AT TIME ZONE 'UTC', item.status, item.matchday, item.stage, item.minute,
          item.updated AT TIME ZONE 'UTC', item.home, item.away, ${league.id}, ${season.id}, item.payload, now()
        FROM jsonb_to_recordset(${JSON.stringify(batch)}::jsonb) AS item(
          id integer, kickoff timestamptz, status "MatchStatus", matchday integer, stage text, minute integer,
          updated timestamptz, home integer, away integer, payload jsonb
        )
        ORDER BY item.id
        ON CONFLICT (id) DO UPDATE SET
          "utcDate" = EXCLUDED."utcDate", status = EXCLUDED.status, matchday = EXCLUDED.matchday,
          stage = EXCLUDED.stage, minute = EXCLUDED.minute, "lastUpdated" = EXCLUDED."lastUpdated",
          "homeTeamId" = EXCLUDED."homeTeamId", "awayTeamId" = EXCLUDED."awayTeamId",
          "leagueId" = EXCLUDED."leagueId", "seasonId" = EXCLUDED."seasonId", "updatedAt" = EXCLUDED."updatedAt",
          "rawData" = (CASE WHEN jsonb_typeof("matches"."rawData") = 'object' THEN "matches"."rawData" ELSE '{}'::jsonb END) || EXCLUDED."rawData"
        WHERE "matches"."lastUpdated" IS NULL OR EXCLUDED."lastUpdated" >= "matches"."lastUpdated"
        RETURNING id
      `
      const updatedIds = new Set(updated.map(({ id }) => id))
      const scores = batch.filter((fixture) => updatedIds.has(fixture.id) && fixture.home_goals !== null && fixture.away_goals !== null)
      if (scores.length) await tx.$executeRaw`
        INSERT INTO "match_scores" (id, "matchId", "homeTeamGoals", "awayTeamGoals", "homeTeamGoalsHT", "awayTeamGoalsHT", winner, duration)
        SELECT item.score_id, item.id, item.home_goals, item.away_goals, item.home_half, item.away_half, item.winner, item.duration
        FROM jsonb_to_recordset(${JSON.stringify(scores)}::jsonb) AS item(
          score_id text, id integer, home_goals integer, away_goals integer, home_half integer, away_half integer,
          winner "Winner", duration "Duration"
        )
        ORDER BY item.id
        ON CONFLICT ("matchId") DO UPDATE SET
          "homeTeamGoals" = EXCLUDED."homeTeamGoals", "awayTeamGoals" = EXCLUDED."awayTeamGoals",
          "homeTeamGoalsHT" = EXCLUDED."homeTeamGoalsHT", "awayTeamGoalsHT" = EXCLUDED."awayTeamGoalsHT",
          winner = EXCLUDED.winner, duration = EXCLUDED.duration
      `
      return updated.length
    }, { maxWait: 10000, timeout: 30000 })
    console.log(`Checked ${Math.min(index + batch.length, fixtures.length)}/${fixtures.length} fixtures`)
  }
  const skippedMatches = matches.matches.length - matchCount

  const table = standings?.standings?.filter((entry) => entry.type === 'TOTAL' && Array.isArray(entry.table)).flatMap((entry) =>
    entry.table.filter((row) => teamIds.has(row.team.id)).map((row) => ({
      seasonId: season.id, teamId: row.team.id, type: 'TOTAL' as const, group: entry.group ?? null,
      position: row.position, playedGames: row.playedGames, wins: row.won, draws: row.draw, losses: row.lost,
      points: row.points, goalsFor: row.goalsFor, goalsAgainst: row.goalsAgainst, goalDifference: row.goalDifference,
    })),
  ) ?? []
  await prisma.$transaction(async (tx) => {
    if (importingCurrentSeason) {
      await tx.season.updateMany({ where: { leagueId: league.id, id: { not: season.id }, isCurrent: true }, data: { isCurrent: false } })
      await tx.season.update({ where: { id: season.id }, data: { isCurrent: true } })
    }
    if (table.length) {
      await tx.standing.deleteMany({ where: { seasonId: season.id, type: 'TOTAL' } })
      await tx.standing.createMany({ data: table })
    }
  }, { maxWait: 10000, timeout: 30000 })
  console.log(`Synced ${competitionCode} season ${year}: ${matchCount} fixtures processed, ${skippedMatches} skipped, ${table.length} standings rows imported, ${squadLinks} new squad memberships.`)
}

syncCurrentSeason()
  .catch((error) => { console.error(error); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
