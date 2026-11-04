/**
 * StatsBomb Open Data seed script
 *
 * Fetches data from HuggingFace dataset `phucnguyne/statsbomb-open-data` and
 * upserts Leagues, Seasons, Teams, Players, Matches, MatchLineups, and
 * MatchEvents into the Prisma-managed PostgreSQL database.
 *
 * Usage:
 *   tsx prisma/seed-statsbomb.ts [--dry-run]
 *
 * Environment:
 *   DATABASE_URL  – Prisma database URL (required unless --dry-run)
 *   HF_TOKEN      – HuggingFace access token (optional, avoids rate-limits)
 */

import { PrismaClient, EventType, MatchStatus, Position, Winner, Side } from '@prisma/client'
import * as dotenv from 'dotenv'
import path from 'node:path'

dotenv.config({ path: path.resolve(__dirname, '../../../.env') })
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') })

// ── Config ────────────────────────────────────────────────────────────────────

const HF_BASE = 'https://huggingface.co/datasets/phucnguyne/statsbomb-open-data/resolve/main/data'

/** Top competitions to seed (StatsBomb competition IDs) */
const TARGET_COMPETITION_IDS = new Set([2, 11, 16, 37, 43, 49])

/** Maximum number of matches to fetch events for (most-recent first) */
const EVENT_MATCH_LIMIT = 50

// ── HuggingFace fetch helper ───────────────────────────────────────────────

const HF_TOKEN = process.env.HF_TOKEN

async function hfFetch<T>(urlPath: string): Promise<T | null> {
  const url = `${HF_BASE}/${urlPath}`
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  if (HF_TOKEN) headers['Authorization'] = `Bearer ${HF_TOKEN}`

  try {
    const res = await fetch(url, { headers })
    if (!res.ok) {
      if (res.status === 404) {
        console.warn(`  [404] Not found: ${url}`)
        return null
      }
      console.error(`  [${res.status}] Failed to fetch: ${url}`)
      return null
    }
    return (await res.json()) as T
  } catch (err) {
    console.error(`  [ERR] Network error fetching ${url}:`, err)
    return null
  }
}

// ── StatsBomb type definitions ─────────────────────────────────────────────

interface SBCompetition {
  competition_id: number
  competition_name: string
  season_id: number
  season_name: string
  competition_gender: string
  country_name: string
}

interface SBMatch {
  match_id: number
  match_date: string
  kick_off: string
  competition: { competition_id: number; competition_name: string }
  season: { season_id: number; season_name: string }
  home_team: { home_team_id: number; home_team_name: string }
  away_team: { away_team_id: number; away_team_name: string }
  home_score: number | null
  away_score: number | null
  match_status: string
  match_week: number | null
}

interface SBLineupEntry {
  team_id: number
  team_name: string
  lineup: Array<{
    player_id: number
    player_name: string
    jersey_number: number
    position: { id: number; name: string }
  }>
}

interface SBEvent {
  id: string
  type: { id: number; name: string }
  minute: number
  second?: number
  team: { id: number; name: string }
  player?: { id: number; name: string }
  pass?: { recipient?: { id?: number; name?: string } }
  shot?: {
    statsbomb_xg?: number
    outcome?: { name?: string }
    technique?: { name?: string }
    body_part?: { name?: string }
  }
  bad_behaviour?: { card?: { name?: string } }
  foul_committed?: { card?: { name?: string } }
  substitution?: { replacement?: { id?: number; name?: string } }
  location?: [number, number]
}

// ── Position mapping ───────────────────────────────────────────────────────

function mapPosition(positionName: string): Position {
  const name = positionName.toLowerCase()
  if (name.includes('goalkeeper') || name.includes('keeper')) return 'GOALKEEPER'
  if (
    name.includes('back') ||
    name.includes('defender') ||
    name.includes('center back') ||
    name.includes('wing back') ||
    name.includes('sweeper')
  )
    return 'DEFENDER'
  if (
    name.includes('midfield') ||
    name.includes('midfielder') ||
    name.includes('defensive mid') ||
    name.includes('attacking mid') ||
    name.includes('central mid') ||
    name.includes('left center mid') ||
    name.includes('right center mid')
  )
    return 'MIDFIELDER'
  return 'FORWARD'
}

// ── Event type mapping ─────────────────────────────────────────────────────

function mapEventType(event: SBEvent): EventType | null {
  const typeName = event.type.name

  if (typeName === 'Shot') {
    const outcome = event.shot?.outcome?.name
    if (outcome === 'Goal') return 'GOAL'
    return 'SHOT'
  }

  if (typeName === 'Bad Behaviour') {
    const card = event.bad_behaviour?.card?.name ?? ''
    if (card.includes('Red')) return 'RED_CARD'
    if (card.includes('Yellow')) return 'YELLOW_CARD'
  }

  if (typeName === 'Foul Committed') {
    const card = event.foul_committed?.card?.name ?? ''
    if (card.includes('Red')) return 'RED_CARD'
    if (card.includes('Second Yellow') || card.includes('Yellow')) return 'YELLOW_CARD'
  }

  switch (typeName) {
    case 'Yellow Card':
      return 'YELLOW_CARD'
    case 'Red Card':
      return 'RED_CARD'
    case 'Substitution':
      return 'SUBSTITUTION'
    default:
      return null
  }
}

// ── Date helpers ───────────────────────────────────────────────────────────

function parseMatchDate(dateStr: string, kickOff: string): Date {
  // kick_off is in "HH:mm:ss.SSS" format
  const timepart = kickOff.split('.')[0] // strip milliseconds
  return new Date(`${dateStr}T${timepart}Z`)
}

function parseSeasonYear(seasonName: string): number {
  // e.g. "2023/2024" → 2023
  const match = seasonName.match(/(\d{4})/)
  return match ? parseInt(match[1], 10) : new Date().getFullYear()
}

function seasonDateRange(seasonName: string): { startDate: Date; endDate: Date } {
  const year = parseSeasonYear(seasonName)
  return {
    startDate: new Date(`${year}-07-01T00:00:00Z`),
    endDate: new Date(`${year + 1}-06-30T23:59:59Z`),
  }
}

// ── Main seed function ────────────────────────────────────────────────────

export async function seedStatsBomb(options: { dryRun?: boolean } = {}) {
  const { dryRun = false } = options

  console.log(`\n🏟️  StatsBomb Seed — ${dryRun ? 'DRY RUN (no DB writes)' : 'LIVE'}`)
  console.log('='.repeat(60))

  const prisma = dryRun ? null : new PrismaClient()

  try {
    // ── Step 1: Fetch competitions ─────────────────────────────────────────
    console.log('\n📋 Fetching competitions list…')
    const competitions = await hfFetch<SBCompetition[]>('competitions.json')
    if (!competitions) throw new Error('Failed to fetch competitions.json')

    const filtered = competitions.filter((c) => TARGET_COMPETITION_IDS.has(c.competition_id))
    console.log(`  Found ${competitions.length} total → ${filtered.length} target competitions`)

    // Collect all matches for event seeding (most recent first)
    const allMatches: { matchId: number; matchDate: Date; homeTeamId: number; awayTeamId: number }[] = []

    // ── Step 2: Seed matches per competition/season ────────────────────────
    for (const comp of filtered) {
      console.log(`\n📌 ${comp.competition_name} — ${comp.season_name}`)

      // Upsert League
      if (!dryRun && prisma) {
        await prisma.league.upsert({
          where: { id: comp.competition_id },
          create: {
            id: comp.competition_id,
            name: comp.competition_name,
            country: comp.country_name,
          },
          update: {
            name: comp.competition_name,
            country: comp.country_name,
          },
        })
      } else {
        console.log(`  [DRY] Upsert League id=${comp.competition_id} name="${comp.competition_name}"`)
      }

      // Upsert Season
      const seasonYear = parseSeasonYear(comp.season_name)
      const { startDate, endDate } = seasonDateRange(comp.season_name)

      let seasonId: number | null = null
      if (!dryRun && prisma) {
        const season = await prisma.season.upsert({
          where: { leagueId_year: { leagueId: comp.competition_id, year: seasonYear } },
          create: {
            leagueId: comp.competition_id,
            year: seasonYear,
            startDate,
            endDate,
          },
          update: { startDate, endDate },
        })
        seasonId = season.id
      } else {
        console.log(`  [DRY] Upsert Season leagueId=${comp.competition_id} year=${seasonYear}`)
        seasonId = -1 // placeholder
      }

      // Fetch matches for this competition/season
      const matches = await hfFetch<SBMatch[]>(
        `matches/${comp.competition_id}/${comp.season_id}.json`,
      )
      if (!matches) {
        console.warn(`  ⚠️  No matches found for competition ${comp.competition_id} season ${comp.season_id}`)
        continue
      }
      console.log(`  → ${matches.length} matches`)

      for (const match of matches) {
        const utcDate = parseMatchDate(match.match_date, match.kick_off ?? '12:00:00.000')
        const isFinished = match.home_score != null && match.away_score != null
        const status: MatchStatus = isFinished ? 'FINISHED' : 'SCHEDULED'

        const homeTeamId = match.home_team.home_team_id
        const awayTeamId = match.away_team.away_team_id

        // Upsert Teams
        if (!dryRun && prisma) {
          await prisma.team.upsert({
            where: { id: homeTeamId },
            create: {
              id: homeTeamId,
              name: match.home_team.home_team_name,
              shortName: match.home_team.home_team_name.slice(0, 20),
            },
            update: { name: match.home_team.home_team_name },
          })
          await prisma.team.upsert({
            where: { id: awayTeamId },
            create: {
              id: awayTeamId,
              name: match.away_team.away_team_name,
              shortName: match.away_team.away_team_name.slice(0, 20),
            },
            update: { name: match.away_team.away_team_name },
          })
        } else {
          console.log(`  [DRY] Upsert Teams: ${match.home_team.home_team_name} vs ${match.away_team.away_team_name}`)
        }

        // Upsert Match
        if (!dryRun && prisma) {
          await prisma.match.upsert({
            where: { id: match.match_id },
            create: {
              id: match.match_id,
              utcDate,
              status,
              matchday: match.match_week,
              homeTeamId,
              awayTeamId,
              leagueId: comp.competition_id,
              seasonId,
              rawData: match as object,
            },
            update: {
              utcDate,
              status,
              matchday: match.match_week,
              rawData: match as object,
            },
          })

          // Upsert MatchScore
          if (isFinished) {
            const homeGoals = match.home_score!
            const awayGoals = match.away_score!
            const winner: Winner | null =
              homeGoals > awayGoals ? 'HOME' : awayGoals > homeGoals ? 'AWAY' : 'DRAW'

            await prisma.matchScore.upsert({
              where: { matchId: match.match_id },
              create: {
                matchId: match.match_id,
                homeTeamGoals: homeGoals,
                awayTeamGoals: awayGoals,
                winner,
              },
              update: {
                homeTeamGoals: homeGoals,
                awayTeamGoals: awayGoals,
                winner,
              },
            })
          }
        } else {
          console.log(
            `  [DRY] Upsert Match id=${match.match_id} ${match.home_team.home_team_name} ${match.home_score ?? '?'}-${match.away_score ?? '?'} ${match.away_team.away_team_name}`,
          )
        }

        allMatches.push({ matchId: match.match_id, matchDate: utcDate, homeTeamId, awayTeamId })

        // ── Step 3: Fetch lineups ─────────────────────────────────────────
        const lineups = await hfFetch<SBLineupEntry[]>(`lineups/${match.match_id}.json`)
        if (lineups) {
          for (const teamLineup of lineups) {
            for (const entry of teamLineup.lineup) {
              const position = mapPosition(entry.position?.name ?? '')

              if (!dryRun && prisma) {
                // Upsert Player
                await prisma.player.upsert({
                  where: { id: entry.player_id },
                  create: {
                    id: entry.player_id,
                    name: entry.player_name,
                    position,
                    shirtNumber: entry.jersey_number,
                  },
                  update: { name: entry.player_name },
                })

                // Upsert MatchLineup
                await prisma.matchLineup.upsert({
                  where: {
                    matchId_teamId_playerId: {
                      matchId: match.match_id,
                      teamId: teamLineup.team_id,
                      playerId: entry.player_id,
                    },
                  },
                  create: {
                    matchId: match.match_id,
                    teamId: teamLineup.team_id,
                    playerId: entry.player_id,
                    isStarter: true,
                    position: entry.position?.name,
                    shirtNumber: entry.jersey_number,
                  },
                  update: {
                    position: entry.position?.name,
                    shirtNumber: entry.jersey_number,
                  },
                })
              } else {
                console.log(
                  `  [DRY] Upsert Player id=${entry.player_id} "${entry.player_name}" pos=${position}`,
                )
              }
            }
          }
        }
      }
    }

    // ── Step 4: Seed events for recent matches ─────────────────────────────
    console.log(`\n⚡ Seeding events for up to ${EVENT_MATCH_LIMIT} most-recent matches…`)

    // Sort by most recent date descending
    const recentMatches = [...allMatches]
      .sort((a, b) => b.matchDate.getTime() - a.matchDate.getTime())
      .slice(0, EVENT_MATCH_LIMIT)

    for (const { matchId, homeTeamId } of recentMatches) {
      console.log(`  Match ${matchId}…`)
      const events = await hfFetch<SBEvent[]>(`events/${matchId}.json`)
      if (!events) continue

      const relevantEvents = events.filter((e) => mapEventType(e) !== null)
      console.log(`    → ${relevantEvents.length} relevant events (of ${events.length} total)`)

      for (const event of relevantEvents) {
        const eventType = mapEventType(event)
        if (!eventType) continue

        const side: Side = event.team.id === homeTeamId ? 'HOME' : 'AWAY'
        const playerId = event.player?.id ?? null
        const location = event.location

        // For substitutions, the replaced player is the "related" player
        let relatedPlayerId: number | null = null
        if (event.substitution?.replacement?.id) {
          relatedPlayerId = event.substitution.replacement.id
        } else if (event.pass?.recipient?.id) {
          relatedPlayerId = event.pass.recipient.id
        }

        const detail =
          event.shot?.technique?.name ??
          event.shot?.body_part?.name ??
          event.substitution?.replacement?.name ??
          null

        const xG = event.shot?.statsbomb_xg ?? null
        const x = location ? +(location[0] / 1.2).toFixed(1) : null
        const y = location ? +(location[1] / 0.8).toFixed(1) : null

        if (!dryRun && prisma) {
          // Use StatsBomb UUID as the event id (it's unique)
          await prisma.matchEvent.upsert({
            where: { id: event.id },
            create: {
              id: event.id,
              matchId,
              type: eventType,
              minute: event.minute,
              team: side,
              playerId,
              relatedPlayerId,
              detail,
              xG,
              x,
              y,
            },
            update: {
              type: eventType,
              minute: event.minute,
              team: side,
              detail,
              xG,
              x,
              y,
            },
          })
        } else {
          console.log(
            `  [DRY] Upsert MatchEvent id=${event.id} type=${eventType} min=${event.minute} player=${event.player?.name ?? 'N/A'}`,
          )
        }
      }
    }

    console.log('\n✅ StatsBomb seed complete!')
  } finally {
    if (prisma) await prisma.$disconnect()
  }
}

// ── CLI entry point ───────────────────────────────────────────────────────

if (process.argv[1] && process.argv[1].endsWith('seed-statsbomb.ts')) {
  const dryRun = process.argv.includes('--dry-run')
  seedStatsBomb({ dryRun }).catch((err) => {
    console.error('❌ Seed failed:', err)
    process.exit(1)
  })
}
