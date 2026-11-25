import 'dotenv/config'
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
  }>(path)
  const sourceSeason = competition.currentSeason
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
  const squadLinks = await importSquads(teams.teams)
  let matchCount = 0
  let skippedMatches = 0
  for (const item of matches.matches) {
    const homeTeamId = item.homeTeam?.id
    const awayTeamId = item.awayTeam?.id
    const utcDate = new Date(item.utcDate)
    const status = statusMap[item.status]
    if (!teamIds.has(homeTeamId) || !teamIds.has(awayTeamId) || !Number.isFinite(utcDate.getTime()) || !status) {
      skippedMatches++
      continue
    }
    const lastUpdated = item.lastUpdated ? new Date(item.lastUpdated) : null
    const common = { utcDate, status, matchday: item.matchday, stage: item.stage, minute: item.minute,
      lastUpdated, homeTeamId, awayTeamId, leagueId: league.id, seasonId: season.id }
    const fullTime = item.score?.fullTime
    await prisma.$transaction(async (tx) => {
      const previous = await tx.match.findUnique({ where: { id: item.id }, select: { lastUpdated: true, rawData: true } })
      if (lastUpdated && previous?.lastUpdated && previous.lastUpdated > lastUpdated) return
      // Preserve already cached detailed provider data and fixture mappings.
      const oldRaw = previous?.rawData
      const rawData = oldRaw && typeof oldRaw === 'object' && !Array.isArray(oldRaw)
        ? { ...oldRaw, ...item } : item
      await tx.match.upsert({
        where: { id: item.id }, update: { ...common, rawData }, create: { id: item.id, ...common, rawData },
      })
      if (typeof fullTime?.home === 'number' && typeof fullTime.away === 'number') {
        const score = { homeTeamGoals: fullTime.home, awayTeamGoals: fullTime.away,
          homeTeamGoalsHT: item.score?.halfTime?.home, awayTeamGoalsHT: item.score?.halfTime?.away,
          winner: winner(item.score?.winner), duration: duration(item.score?.duration) }
        await tx.matchScore.upsert({
          where: { matchId: item.id }, update: score, create: { matchId: item.id, ...score },
        })
      }
    })
    matchCount++
  }
  if (!matchCount) throw new Error('No valid fixtures returned by the provider')

  const table = standings?.standings?.filter((entry) => entry.type === 'TOTAL' && Array.isArray(entry.table)).flatMap((entry) =>
    entry.table.filter((row) => teamIds.has(row.team.id)).map((row) => ({
      seasonId: season.id, teamId: row.team.id, type: 'TOTAL' as const, group: entry.group ?? null,
      position: row.position, playedGames: row.playedGames, wins: row.won, draws: row.draw, losses: row.lost,
      points: row.points, goalsFor: row.goalsFor, goalsAgainst: row.goalsAgainst, goalDifference: row.goalDifference,
    })),
  ) ?? []
  await prisma.$transaction(async (tx) => {
    await tx.season.updateMany({ where: { leagueId: league.id, id: { not: season.id }, isCurrent: true }, data: { isCurrent: false } })
    await tx.season.update({ where: { id: season.id }, data: { isCurrent: true } })
    if (table.length) {
      await tx.standing.deleteMany({ where: { seasonId: season.id, type: 'TOTAL' } })
      await tx.standing.createMany({ data: table })
    }
  })
  console.log(`Synced ${competitionCode} season ${year}: ${matchCount} fixtures processed, ${skippedMatches} skipped, ${table.length} standings rows imported, ${squadLinks} new squad memberships.`)
}

syncCurrentSeason()
  .catch((error) => { console.error(error); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
