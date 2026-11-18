/**
 * seed-statsbomb.ts
 *
 * Seeds the database with StatsBomb Open Data from HuggingFace.
 * Dataset: phucnguyne/statsbomb-open-data (private)
 *
 * Usage:
 *   cd packages/database
 *   HF_TOKEN=hf_xxx tsx scripts/seed-statsbomb.ts
 *   HF_TOKEN=hf_xxx tsx scripts/seed-statsbomb.ts --dry-run
 *   HF_TOKEN=hf_xxx tsx scripts/seed-statsbomb.ts --competition=11 --season=1
 *   HF_TOKEN=hf_xxx tsx scripts/seed-statsbomb.ts --events           # also seed match events
 *   HF_TOKEN=hf_xxx tsx scripts/seed-statsbomb.ts --lineups          # also seed lineups
 */

import 'dotenv/config'
import { env } from '@app/config'
import { PrismaClient, MatchStatus, Winner } from '@prisma/client'

const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } })

// ── CLI args ─────────────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run')
const SEED_EVENTS = process.argv.includes('--events')
const SEED_LINEUPS = process.argv.includes('--lineups')
const FILTER_COMPETITION = process.argv.find((a) => a.startsWith('--competition='))?.split('=')[1]
const FILTER_SEASON = process.argv.find((a) => a.startsWith('--season='))?.split('=')[1]

// Top competitions to seed by default (StatsBomb competition_id)
const DEFAULT_COMPETITIONS = [
  11,   // La Liga
  2,    // Premier League  (StatsBomb)
  9,    // Bundesliga
  7,    // Ligue 1
  12,   // Serie A
  16,   // Champions League
  37,   // NWSL
  43,   // FIFA World Cup
  55,   // UEFA Euro
  72,   // Men's Olympics
]

// ── HuggingFace fetch helpers ─────────────────────────────────────────────────
const HF_TOKEN = process.env.HF_TOKEN ?? ''
const HF_DATASET_URL =
  process.env.HF_DATASET_URL ??
  'https://huggingface.co/datasets/phucnguyne/statsbomb-open-data/resolve/main/data'
const HF_API_URL =
  'https://huggingface.co/api/datasets/phucnguyne/statsbomb-open-data/tree/main/data'

function hfHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  if (HF_TOKEN) headers.Authorization = `Bearer ${HF_TOKEN}`
  return headers
}

async function hfJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${HF_DATASET_URL}/${path}`, { headers: hfHeaders() })
    if (!res.ok) {
      if (res.status !== 404) console.warn(`[HF] ${path}: ${res.status}`)
      return null
    }
    return (await res.json()) as T
  } catch (err) {
    console.warn(`[HF] fetch error ${path}:`, err)
    return null
  }
}

async function hfList(subpath: string): Promise<{ path: string; type: string }[]> {
  try {
    const res = await fetch(`${HF_API_URL}/${subpath}`, { headers: hfHeaders() })
    if (!res.ok) return []
    return (await res.json()) as { path: string; type: string }[]
  } catch {
    return []
  }
}

// ── StatsBomb types ───────────────────────────────────────────────────────────
interface SBCompetition {
  competition_id: number
  season_id: number
  country_name: string
  competition_name: string
  competition_gender: string
  season_name: string
  match_available?: string
}

interface SBMatch {
  match_id: number
  match_date: string
  kick_off?: string
  competition: { competition_id: number; country_name: string; competition_name: string }
  season: { season_id: number; season_name: string }
  home_team: { home_team_id: number; home_team_name: string }
  away_team: { away_team_id: number; away_team_name: string }
  home_score?: number
  away_score?: number
  match_status?: string
  match_week?: number
  competition_stage?: { name: string }
  stadium?: { id: number; name: string }
  referee?: { id: number; name: string }
}

interface SBLineupPlayer {
  player_id: number
  player_name: string
  jersey_number: number
  position?: { id: number; name: string }
}

interface SBLineup {
  team_id: number
  team_name: string
  lineup: SBLineupPlayer[]
}

interface SBEvent {
  id: string
  type?: { id: number; name: string }
  minute?: number
  second?: number
  period?: number
  team?: { id: number; name: string }
  player?: { id: number; name: string }
  position?: { id: number; name: string }
  location?: number[]
  shot?: { statsbomb_xg?: number; outcome?: { name: string } }
  pass?: { recipient?: { id: number; name: string }; outcome?: { name: string } }
  substitution?: { replacement?: { id: number; name: string } }
  foul_committed?: { card?: { name: string } }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function sbStatusToMatchStatus(status?: string): MatchStatus {
  if (status === 'available') return 'FINISHED'
  if (status === 'scheduled') return 'SCHEDULED'
  return 'FINISHED'
}

function sbWinner(homeScore?: number, awayScore?: number): Winner | null {
  if (homeScore == null || awayScore == null) return null
  if (homeScore > awayScore) return 'HOME'
  if (awayScore > homeScore) return 'AWAY'
  return 'DRAW'
}

function parseSeasonYear(seasonName: string): number {
  // "2017/2018" → 2017; "2023" → 2023
  const match = seasonName.match(/^(\d{4})/)
  return match ? parseInt(match[1], 10) : new Date().getFullYear()
}

function mapPosition(position?: string): 'GOALKEEPER' | 'DEFENDER' | 'MIDFIELDER' | 'FORWARD' {
  const value = position?.toLowerCase() ?? ''
  if (value.includes('keeper')) return 'GOALKEEPER'
  if (value.includes('back') || value.includes('defender')) return 'DEFENDER'
  if (value.includes('midfield')) return 'MIDFIELDER'
  return 'FORWARD'
}

function mapEventType(event: SBEvent, homeTeamId: number): {
  type: string
  team: 'HOME' | 'AWAY'
  relatedPlayerId?: number
} | null {
  const typeName = event.type?.name
  const teamId = event.team?.id
  const side: 'HOME' | 'AWAY' = teamId === homeTeamId ? 'HOME' : 'AWAY'

  switch (typeName) {
    case 'Shot':
      if (event.shot?.outcome?.name === 'Goal') return { type: 'GOAL', team: side }
      return { type: 'SHOT', team: side }
    case 'Yellow Card':
      return { type: 'YELLOW_CARD', team: side }
    case 'Red Card':
      return { type: 'RED_CARD', team: side }
    case 'Substitution':
      return {
        type: 'SUBSTITUTION',
        team: side,
        relatedPlayerId: event.substitution?.replacement?.id,
      }
    case 'Bad Behaviour':
      if (event.foul_committed?.card?.name === 'Red Card') return { type: 'RED_CARD', team: side }
      if (event.foul_committed?.card?.name?.includes('Yellow')) return { type: 'YELLOW_CARD', team: side }
      return null
    default:
      return null
  }
}

// ── Main seed logic ───────────────────────────────────────────────────────────
async function seedStatsBomb() {
  if (!HF_TOKEN) {
    console.error('❌  HF_TOKEN is not set. Export it before running this script.')
    process.exit(1)
  }

  console.log(`🏁  StatsBomb seed starting${DRY_RUN ? ' (DRY RUN)' : ''}`)
  console.log(`    Events: ${SEED_EVENTS}  Lineups: ${SEED_LINEUPS}`)

  // 1. Load competitions list
  const competitions = await hfJson<SBCompetition[]>('competitions.json')
  if (!competitions) {
    console.error('❌  Failed to fetch competitions.json')
    process.exit(1)
  }
  console.log(`📋  ${competitions.length} competition/season entries found`)

  // 2. Filter to target competitions
  const targets = competitions.filter((c) => {
    if (FILTER_COMPETITION && String(c.competition_id) !== FILTER_COMPETITION) return false
    if (FILTER_SEASON && String(c.season_id) !== FILTER_SEASON) return false
    if (!FILTER_COMPETITION && !DEFAULT_COMPETITIONS.includes(c.competition_id)) return false
    return true
  })
  console.log(`🎯  Processing ${targets.length} competition/season combinations`)

  let matchCount = 0
  let playerCount = 0
  let eventCount = 0

  for (const comp of targets) {
    console.log(`\n📁  ${comp.competition_name} ${comp.season_name} (${comp.competition_id}/${comp.season_id})`)

    // 3. Upsert League
    if (!DRY_RUN) {
      await prisma.league.upsert({
        where: { id: comp.competition_id },
        update: { name: comp.competition_name, country: comp.country_name },
        create: {
          id: comp.competition_id,
          name: comp.competition_name,
          country: comp.country_name,
        },
      })
    }

    // 4. Upsert Season
    const year = parseSeasonYear(comp.season_name)
    let seasonId: number | null = null
    if (!DRY_RUN) {
      const season = await prisma.season.upsert({
        where: { leagueId_year: { leagueId: comp.competition_id, year } },
        update: { isCurrent: false },
        create: {
          leagueId: comp.competition_id,
          year,
          startDate: new Date(`${year}-07-01`),
          endDate: new Date(`${year + 1}-06-30`),
          isCurrent: false,
        },
      })
      seasonId = season.id
    }

    // 5. Fetch matches for this competition/season
    const matches = await hfJson<SBMatch[]>(`matches/${comp.competition_id}/${comp.season_id}.json`)
    if (!matches) {
      console.warn(`  ⚠️  No matches found`)
      continue
    }
    console.log(`  ⚽  ${matches.length} matches`)

    for (const m of matches) {
      // Upsert home team
      if (!DRY_RUN) {
        await prisma.team.upsert({
          where: { id: m.home_team.home_team_id },
          update: { name: m.home_team.home_team_name },
          create: {
            id: m.home_team.home_team_id,
            name: m.home_team.home_team_name,
            shortName: m.home_team.home_team_name.slice(0, 20),
          },
        })
        // Upsert away team
        await prisma.team.upsert({
          where: { id: m.away_team.away_team_id },
          update: { name: m.away_team.away_team_name },
          create: {
            id: m.away_team.away_team_id,
            name: m.away_team.away_team_name,
            shortName: m.away_team.away_team_name.slice(0, 20),
          },
        })

        // Build utcDate
        const dateStr = m.match_date
        const timeStr = m.kick_off?.slice(0, 8) ?? '12:00:00'
        const utcDate = new Date(`${dateStr}T${timeStr}Z`)

        const status = sbStatusToMatchStatus(m.match_status)

        // Upsert Match
        const match = await prisma.match.upsert({
          where: { id: m.match_id },
          update: {
            status,
            matchday: m.match_week,
            lastUpdated: new Date(),
          },
          create: {
            id: m.match_id,
            utcDate,
            status,
            matchday: m.match_week,
            stage: m.competition_stage?.name,
            homeTeamId: m.home_team.home_team_id,
            awayTeamId: m.away_team.away_team_id,
            leagueId: comp.competition_id,
            ...(seasonId ? { seasonId } : {}),
          },
        })

        // Upsert MatchScore if finished
        if (m.home_score != null && m.away_score != null) {
          await prisma.matchScore.upsert({
            where: { matchId: match.id },
            update: {
              homeTeamGoals: m.home_score,
              awayTeamGoals: m.away_score,
              winner: sbWinner(m.home_score, m.away_score),
              duration: 'REGULAR',
            },
            create: {
              matchId: match.id,
              homeTeamGoals: m.home_score,
              awayTeamGoals: m.away_score,
              winner: sbWinner(m.home_score, m.away_score),
              duration: 'REGULAR',
            },
          })
        }

        matchCount++
      } else {
        console.log(`  [DRY] Match ${m.match_id}: ${m.home_team.home_team_name} vs ${m.away_team.away_team_name}`)
        matchCount++
      }

      // 6. Seed lineups (optional)
      if (SEED_LINEUPS && !DRY_RUN) {
        const lineups = await hfJson<SBLineup[]>(`lineups/${m.match_id}.json`)
        if (lineups) {
          for (const teamLineup of lineups) {
            for (const p of teamLineup.lineup) {
              // Upsert player
              await prisma.player.upsert({
                where: { id: p.player_id },
                update: { name: p.player_name, shirtNumber: p.jersey_number },
                create: {
                  id: p.player_id,
                  name: p.player_name,
                  shirtNumber: p.jersey_number,
                  position: mapPosition(p.position?.name),
                },
              })
              playerCount++

              // Upsert MatchLineup
              try {
                await prisma.matchLineup.upsert({
                  where: {
                    matchId_teamId_playerId: {
                      matchId: m.match_id,
                      teamId: teamLineup.team_id,
                      playerId: p.player_id,
                    },
                  },
                  update: {
                    shirtNumber: p.jersey_number,
                    position: mapPosition(p.position?.name),
                  },
                  create: {
                    matchId: m.match_id,
                    teamId: teamLineup.team_id,
                    playerId: p.player_id,
                    isStarter: true,
                    shirtNumber: p.jersey_number,
                    position: p.position?.name,
                  },
                })
              } catch {
                // May fail if team not yet seeded — skip
              }
            }
          }
        }
      }

      // 7. Seed match events (optional)
      if (SEED_EVENTS && !DRY_RUN) {
        const events = await hfJson<SBEvent[]>(`events/${m.match_id}.json`)
        if (events) {
          // Clear existing events first to avoid duplicates
          await prisma.matchEvent.deleteMany({ where: { matchId: m.match_id } })

          const relevantEvents = events.filter((e) => {
            const name = e.type?.name
            return ['Shot', 'Yellow Card', 'Red Card', 'Substitution', 'Bad Behaviour'].includes(name ?? '')
          })

          for (const event of relevantEvents) {
            const mapped = mapEventType(event, m.home_team.home_team_id)
            if (!mapped) continue

            try {
              await prisma.matchEvent.create({
                data: {
                  matchId: m.match_id,
                  type: mapped.type as any,
                  minute: event.minute ?? 0,
                  minuteExtra: null,
                  team: mapped.team,
                  playerId: event.player?.id ?? null,
                  relatedPlayerId: mapped.relatedPlayerId ?? null,
                  detail: event.shot?.outcome?.name ?? null,
                },
              })
              eventCount++
            } catch {
              // Skip duplicates or missing relations
            }
          }
        }
      }
    }
  }

  console.log(`\n✅  Seeding complete`)
  console.log(`    Matches:  ${matchCount}`)
  console.log(`    Players:  ${playerCount}`)
  console.log(`    Events:   ${eventCount}`)
}

// ── Run ───────────────────────────────────────────────────────────────────────
seedStatsBomb()
  .catch((err) => {
    console.error('❌  Seed failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
