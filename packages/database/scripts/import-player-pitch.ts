import { readFileSync } from 'node:fs'
import { PrismaClient, type Prisma } from '@prisma/client'
import { nameKey, providerNumber, splitCsvRow, teamKey, uniqueMatch } from './player-import-identity'

const arg = (key: string) => process.argv.find((value) => value.startsWith(`--${key}=`))?.slice(key.length + 3)
const source = arg('source')
const write = process.argv.includes('--write')
const onlyPlayer = arg('player')
const db = new PrismaClient()
type Point = Prisma.PlayerPitchPointCreateManyInput

function input(key: string) {
  const path = arg(key)
  if (!path) throw new Error(`Missing --${key}=PATH`)
  return readFileSync(path, 'utf8')
}

function csv(key: string, required: string[]) {
  const [header, ...rows] = input(key).replace(/^\uFEFF/, '').trimEnd().split(/\r?\n/)
  const fields = splitCsvRow(header)
  if (!required.every((column) => fields.includes(column))) throw new Error(`Missing required columns in --${key}`)
  return rows.map((row) => {
    const values = splitCsvRow(row)
    if (values.length !== fields.length) throw new Error(`Invalid CSV row in --${key}`)
    return Object.fromEntries(fields.map((field, index) => [field, values[index]]))
  })
}

function roster() {
  return db.player.findMany({
    where: { dateOfBirth: { not: null }, ...(onlyPlayer ? { id: Number(onlyPlayer) } : {}) },
    select: { id: true, name: true, dateOfBirth: true },
  })
}

function matchingPlayer(players: Awaited<ReturnType<typeof roster>>, birthDate: string, names: (string | undefined)[]) {
  const keys = new Set(names.map(nameKey).filter(Boolean))
  if (!/^\d{4}-\d\d-\d\d$/.test(birthDate)) return undefined
  return uniqueMatch(players, (player) => player.dateOfBirth?.toISOString().slice(0, 10) === birthDate && keys.has(nameKey(player.name)))
}

async function wyscout() {
  const players = await roster()
  const externalPlayers: { wyId: number; birthDate: string; shortName?: string; firstName?: string; lastName?: string }[] =
    JSON.parse(input('players'))
  const externalMatches: { wyId: number; dateutc: string }[] = JSON.parse(input('fixtures'))
  const events: { id: number; playerId: number; matchId: number; matchPeriod: string; eventName: string; positions?: { x: number; y: number }[] }[] =
    JSON.parse(input('events'))

  const ids = new Map(externalPlayers.flatMap((player) => {
    const local = matchingPlayer(players, player.birthDate, [player.shortName, `${player.firstName ?? ''} ${player.lastName ?? ''}`])
    return local ? [[player.wyId, local.id] as const] : []
  }))
  const matches = new Map(externalMatches.flatMap((match) => {
    const date = new Date(`${match.dateutc.replace(' ', 'T')}Z`)
    return Number.isFinite(+date) && date >= new Date('2017-07-01') && date < new Date('2018-07-01')
      ? [[match.wyId, date] as const] : []
  }))
  const points: Point[] = []
  for (const event of events) {
    const playerId = ids.get(event.playerId)
    const date = matches.get(event.matchId)
    if (!playerId || !date || !['1H', '2H'].includes(event.matchPeriod) ||
        !['Pass', 'Shot', 'Duel', 'Free Kick', 'Others on the ball'].includes(event.eventName)) continue
    const x = providerNumber(event.positions?.[0]?.x, { max: 100 })
    const y = providerNumber(event.positions?.[0]?.y, { max: 100 })
    if (x === null || y === null) continue
    points.push({
      source: 'WYSCOUT_OPEN_DATA', externalId: String(event.id), externalMatchId: String(event.matchId),
      playerId, season: 2017, date, x, y,
    })
  }
  return points
}

async function shots() {
  const year = Number(arg('season'))
  if (!Number.isInteger(year) || year < 1992) throw new Error('Specify --season=YYYY')
  const people = csv('players', ['player_id', 'date_of_birth', 'web_name', 'first_name', 'second_name'])
  const fixtures = csv('fixtures', ['fixture_id', 'home_team', 'away_team', 'kickoff_time'])
  const form = csv('appearances', ['fixture_id', 'element', 'was_home', 'minutes'])
  const attempts = csv('events', ['shot_id', 'fixture_id', 'h_a', 'player', 'x', 'y', 'xg'])
  const [players, matches] = await Promise.all([
    roster(),
    db.match.findMany({
      where: { leagueId: 2021, status: 'FINISHED', season: { year } },
      select: { id: true, utcDate: true,
        homeTeam: { select: { name: true, shortName: true } }, awayTeam: { select: { name: true, shortName: true } } },
    }),
  ])
  const matchesByFixture = new Map(fixtures.flatMap((fixture) => {
    const equalClub = (external: string, club: { name: string; shortName: string }) =>
      [club.name, club.shortName].some((name) => teamKey(external) === teamKey(name))
    const match = uniqueMatch(matches, (candidate) => equalClub(fixture.home_team, candidate.homeTeam) &&
      equalClub(fixture.away_team, candidate.awayTeam) &&
      Math.abs(Date.parse(fixture.kickoff_time) - candidate.utcDate.getTime()) <= 30 * 60_000)
    return match ? [[fixture.fixture_id, match] as const] : []
  }))
  const byId = new Map(people.map((person) => [person.player_id, {
    local: matchingPlayer(players, person.date_of_birth || person.dob_tm, [
      person.web_name, person.full_name, person.known_name, `${person.first_name} ${person.second_name}`,
    ]),
    names: [person.web_name, person.full_name, person.known_name, person.second_name,
      `${person.first_name} ${person.second_name}`].map(nameKey).filter(Boolean),
  }]))
  const appearances = new Map<string, NonNullable<ReturnType<typeof byId.get>>[]>()
  for (const row of form) {
    if (!(Number(row.minutes) > 0) || !['0', '1'].includes(row.was_home)) continue
    const person = byId.get(row.element)
    if (!person) continue
    const groupKey = `${row.fixture_id}:${row.was_home === '1' ? 'h' : 'a'}`
    const group = appearances.get(groupKey) ?? []
    group.push(person)
    appearances.set(groupKey, group)
  }
  return attempts.flatMap((attempt): Point[] => {
    const match = matchesByFixture.get(attempt.fixture_id)
    const candidates = appearances.get(`${attempt.fixture_id}:${attempt.h_a}`) ?? []
    const player = uniqueMatch(candidates, ({ names }) => names.includes(nameKey(attempt.player)))?.local
    const x = providerNumber(attempt.x, { max: 1 })
    const y = providerNumber(attempt.y, { max: 1 })
    if (!attempt.shot_id || !match || !player || x === null || y === null) return []
    return [{
      source: 'UNDERSTAT_SHOTS', externalId: attempt.shot_id, externalMatchId: String(match.id),
      playerId: player.id, season: year, date: match.utcDate, x: x * 100, y: y * 100,
      xG: providerNumber(attempt.xg, { max: 1 }),
    }]
  })
}

async function run() {
  if (!['wyscout', 'shots'].includes(source ?? '')) throw new Error('Use --source=wyscout|shots with input file paths')
  if (onlyPlayer && (!Number.isSafeInteger(Number(onlyPlayer)) || Number(onlyPlayer) <= 0)) throw new Error('Invalid --player=ID')
  const points = await (source === 'wyscout' ? wyscout() : shots())
  let added = 0
  if (write) {
    for (let start = 0; start < points.length; start += 500) {
      const result = await db.playerPitchPoint.createMany({ data: points.slice(start, start + 500), skipDuplicates: true })
      added += result.count
    }
  }
  console.log(JSON.stringify({
    source, mode: write ? 'write' : 'dry-run', points: points.length, added,
    players: new Set(points.map((point) => point.playerId)).size,
    matches: new Set(points.map((point) => point.externalMatchId)).size,
  }))
}

void run().catch((error: Error) => {
  console.error(error.message)
  process.exitCode = 1
}).finally(() => db.$disconnect())
