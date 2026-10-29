/**
 * Career Statistics Generator
 *
 * Generates deterministic season-by-season career histories for any player.
 * Uses a seeded PRNG so the same playerId always produces the same career arc.
 * The "current season" stats are passed in from the DB; historical seasons
 * are synthesised with realistic variation around those base stats.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CareerTeam {
  id: number
  name: string
  shortName: string
  crest?: string
}

export interface CareerSeason {
  year: string        // e.g. "2024/25"
  team: CareerTeam
  competition: string
  matchesPlayed: number
  minutesPlayed: number
  goals: number
  assists: number
  yellowCards: number
  redCards: number
  xG: number
  xA: number
  avgRating: number   // 5.5 – 9.2
  isCurrent: boolean
}

export interface CareerMilestone {
  icon: string
  title: string
  description: string
  season: string
  type: 'goal' | 'assist' | 'appearance' | 'award' | 'debut' | 'transfer'
}

export interface ClubHistoryEntry {
  team: CareerTeam
  from: number       // year
  to: number | null  // null = present
  appearances: number
  goals: number
  assists: number
}

export interface CareerStats {
  playerId: number
  totalSeasons: number
  totalMatches: number
  totalGoals: number
  totalAssists: number
  totalMinutes: number
  seasons: CareerSeason[]          // chronological, oldest first
  milestones: CareerMilestone[]
  clubHistory: ClubHistoryEntry[]
  peakSeason: CareerSeason | null  // highest goals in a season
  careerAvgRating: number
}

// ── Premier League team pool (for historical clubs) ───────────────────────────

const PL_TEAMS: CareerTeam[] = [
  { id: 64,  name: 'Liverpool FC',              shortName: 'Liverpool',  crest: 'https://crests.football-data.org/64.png'  },
  { id: 65,  name: 'Manchester City FC',        shortName: 'Man City',   crest: 'https://crests.football-data.org/65.png'  },
  { id: 57,  name: 'Arsenal FC',               shortName: 'Arsenal',    crest: 'https://crests.football-data.org/57.png'  },
  { id: 61,  name: 'Chelsea FC',               shortName: 'Chelsea',    crest: 'https://crests.football-data.org/61.png'  },
  { id: 66,  name: 'Manchester United FC',      shortName: 'Man Utd',    crest: 'https://crests.football-data.org/66.png'  },
  { id: 73,  name: 'Tottenham Hotspur FC',      shortName: 'Spurs',      crest: 'https://crests.football-data.org/73.png'  },
  { id: 67,  name: 'Newcastle United FC',       shortName: 'Newcastle',  crest: 'https://crests.football-data.org/67.png'  },
  { id: 58,  name: 'Aston Villa FC',           shortName: 'Aston Villa',crest: 'https://crests.football-data.org/58.png'  },
  { id: 397, name: 'Brighton & Hove Albion FC', shortName: 'Brighton',   crest: 'https://crests.football-data.org/397.png' },
  { id: 402, name: 'Brentford FC',             shortName: 'Brentford',  crest: 'https://crests.football-data.org/402.png' },
  { id: 76,  name: 'Wolverhampton Wanderers FC',shortName: 'Wolves',     crest: 'https://crests.football-data.org/76.png'  },
  { id: 354, name: 'Crystal Palace FC',        shortName: 'Crystal Palace',crest:'https://crests.football-data.org/354.png'},
  { id: 62,  name: 'Everton FC',              shortName: 'Everton',    crest: 'https://crests.football-data.org/62.png'  },
  { id: 60,  name: 'West Ham United FC',       shortName: 'West Ham',   crest: 'https://crests.football-data.org/60.png'  },
  { id: 563, name: 'West Bromwich Albion FC',  shortName: 'West Brom',  crest: 'https://crests.football-data.org/563.png' },
  { id: 68,  name: 'Norwich City FC',          shortName: 'Norwich',    crest: 'https://crests.football-data.org/68.png'  },
  { id: 71,  name: 'Watford FC',              shortName: 'Watford',    crest: 'https://crests.football-data.org/71.png'  },
  { id: 345, name: 'Burnley FC',              shortName: 'Burnley',    crest: 'https://crests.football-data.org/345.png' },
]

const COMPETITIONS = [
  'Premier League', 'Premier League', 'Premier League',
  'Championship', 'Bundesliga', 'La Liga', 'Serie A', 'Ligue 1',
]

// ── Seeded PRNG ───────────────────────────────────────────────────────────────

function sr(seed: number, offset = 0): number {
  const s = Math.sin(seed * 9301 + offset * 49297 + 233) * 49979
  return s - Math.floor(s)
}

function rRange(min: number, max: number, seed: number, offset: number): number {
  return +(min + sr(seed, offset) * (max - min)).toFixed(2)
}

function iRange(min: number, max: number, seed: number, offset: number): number {
  return Math.round(min + sr(seed, offset) * (max - min))
}

function pickIdx(len: number, seed: number, offset: number): number {
  return Math.floor(sr(seed, offset) * len)
}

// ── Milestone templates ───────────────────────────────────────────────────────

function buildMilestones(
  seasons: CareerSeason[],
  playerId: number,
  position: string
): CareerMilestone[] {
  const milestones: CareerMilestone[] = []

  // Career debut (first season)
  if (seasons.length > 0) {
    milestones.push({
      icon: '🏟️',
      title: 'Professional Debut',
      description: `Made senior debut for ${seasons[0].team.shortName} in the ${seasons[0].competition}.`,
      season: seasons[0].year,
      type: 'debut',
    })
  }

  // Running totals for threshold milestones
  let cumulativeGoals = 0
  let cumulativeAssists = 0
  let cumulativeApps = 0
  const goalThresholds  = [10, 25, 50, 75, 100, 150, 200]
  const assistThresholds = [10, 25, 50, 75, 100]
  const appThresholds   = [50, 100, 150, 200, 250, 300]

  for (const s of seasons) {
    const prevGoals   = cumulativeGoals
    const prevAssists = cumulativeAssists
    const prevApps    = cumulativeApps

    cumulativeGoals   += s.goals
    cumulativeAssists += s.assists
    cumulativeApps    += s.matchesPlayed

    for (const t of goalThresholds) {
      if (prevGoals < t && cumulativeGoals >= t) {
        milestones.push({
          icon: '⚽',
          title: `${t} Career Goals`,
          description: `Reached ${t} career goals while playing for ${s.team.shortName}.`,
          season: s.year,
          type: 'goal',
        })
      }
    }
    for (const t of assistThresholds) {
      if (prevAssists < t && cumulativeAssists >= t) {
        milestones.push({
          icon: '🎯',
          title: `${t} Career Assists`,
          description: `Registered ${t} career assists during the ${s.year} season.`,
          season: s.year,
          type: 'assist',
        })
      }
    }
    for (const t of appThresholds) {
      if (prevApps < t && cumulativeApps >= t) {
        milestones.push({
          icon: '🎖️',
          title: `${t} Career Appearances`,
          description: `Played ${t}th career match for ${s.team.shortName}.`,
          season: s.year,
          type: 'appearance',
        })
      }
    }

    // Season award for high-rating seasons
    if (s.avgRating >= 7.8 && !s.isCurrent) {
      milestones.push({
        icon: '🏆',
        title: 'Player of the Season Nominee',
        description: `Outstanding ${s.year} season with ${s.team.shortName} — avg rating ${s.avgRating.toFixed(1)}.`,
        season: s.year,
        type: 'award',
      })
    }
  }

  // Club transfers (when team changes between seasons)
  for (let i = 1; i < seasons.length; i++) {
    if (seasons[i].team.id !== seasons[i - 1].team.id) {
      milestones.push({
        icon: '✈️',
        title: `Joined ${seasons[i].team.shortName}`,
        description: `Transferred from ${seasons[i - 1].team.shortName} ahead of the ${seasons[i].year} season.`,
        season: seasons[i].year,
        type: 'transfer',
      })
    }
  }

  // Sort chronologically (oldest first)
  milestones.sort((a, b) => a.season.localeCompare(b.season))

  // Cap at 8 milestones
  return milestones.slice(0, 8)
}

// ── Club history builder ──────────────────────────────────────────────────────

function buildClubHistory(seasons: CareerSeason[]): ClubHistoryEntry[] {
  const clubMap: Map<number, ClubHistoryEntry> = new Map()
  const orderList: number[] = []  // track insertion order

  const startYear = new Date().getFullYear() - 1 - seasons.length + 1

  for (let i = 0; i < seasons.length; i++) {
    const s = seasons[i]
    const year = startYear + i

    if (!clubMap.has(s.team.id)) {
      clubMap.set(s.team.id, {
        team:        s.team,
        from:        year,
        to:          null,
        appearances: 0,
        goals:       0,
        assists:     0,
      })
      orderList.push(s.team.id)
    }

    const entry = clubMap.get(s.team.id)!
    entry.appearances += s.matchesPlayed
    entry.goals       += s.goals
    entry.assists     += s.assists
    entry.to           = s.isCurrent ? null : year
  }

  return orderList.map(id => clubMap.get(id)!)
}

// ── Main generator ────────────────────────────────────────────────────────────

export interface CareerInput {
  playerId: number
  position: string   // 'GOALKEEPER' | 'DEFENDER' | 'MIDFIELDER' | 'FORWARD'
  currentTeam?: CareerTeam | null
  currentStats?: {
    matchesPlayed: number
    minutesPlayed: number
    goals: number
    assists: number
    yellowCards: number
    redCards: number
    xG: number
    xA: number
  } | null
}

export function generateCareerStats(input: CareerInput): CareerStats {
  const { playerId, position, currentTeam, currentStats } = input
  const seed = playerId

  // How many historical seasons (2–4 before current)
  const histCount = iRange(2, 4, seed, 1)

  // Position-based scoring multipliers
  const isFwd = position === 'FORWARD'
  const isMid = position === 'MIDFIELDER'
  const isDef = position === 'DEFENDER'
  const isGk  = position === 'GOALKEEPER'

  const goalMulti   = isFwd ? 1.0 : isMid ? 0.45 : isDef ? 0.12 : 0.01
  const assistMulti = isFwd ? 0.5 : isMid ? 1.0  : isDef ? 0.25 : 0.05

  // Base stats from current season (or fall back to position defaults)
  const baseGoals   = currentStats?.goals        ?? Math.round(iRange(4, 18, seed, 3) * goalMulti)
  const baseAssists = currentStats?.assists      ?? Math.round(iRange(3, 12, seed, 4) * assistMulti)
  const baseXG      = currentStats?.xG           ?? rRange(1, 15, seed, 5) * goalMulti
  const baseXA      = currentStats?.xA           ?? rRange(1, 10, seed, 6) * assistMulti
  const baseMatches = currentStats?.matchesPlayed ?? iRange(22, 38, seed, 7)
  const baseMinutes = currentStats?.minutesPlayed ?? baseMatches * iRange(65, 90, seed, 8)

  // Current season label — derived from the current calendar year so it stays accurate
  const currentYear = new Date().getFullYear()
  const currentLabel = `${currentYear - 1}/${String(currentYear).slice(2)}`

  // Build current season entry
  const currentSeason: CareerSeason = {
    year:         currentLabel,
    team:         currentTeam ?? PL_TEAMS[pickIdx(PL_TEAMS.length, seed, 9)],
    competition:  'Premier League',
    matchesPlayed: currentStats?.matchesPlayed  ?? baseMatches,
    minutesPlayed: currentStats?.minutesPlayed  ?? baseMinutes,
    goals:         currentStats?.goals          ?? baseGoals,
    assists:       currentStats?.assists        ?? baseAssists,
    yellowCards:   currentStats?.yellowCards    ?? iRange(0, 6, seed, 10),
    redCards:      currentStats?.redCards       ?? (sr(seed, 11) < 0.15 ? 1 : 0),
    xG:            +(currentStats?.xG           ?? baseXG).toFixed(2),
    xA:            +(currentStats?.xA           ?? baseXA).toFixed(2),
    avgRating:     rRange(6.2, 8.6, seed, 12),
    isCurrent:     true,
  }

  // Track which team IDs have been used for historical seasons
  const usedTeamIds = new Set<number>([currentSeason.team.id])

  // Determine which historical teams to use
  // Use a different team for 1–2 clubs, same club for the rest
  const historicalSeasons: CareerSeason[] = []

  for (let i = 0; i < histCount; i++) {
    const seasonOffset = histCount - i  // distance from current (1 = most recent past)
    const yearStart    = currentYear - seasonOffset - 1
    const yearEnd      = yearStart + 1
    const yearLabel    = `${yearStart}/${String(yearEnd).slice(2)}`

    // Decide if player was at the same club or a different one
    const changingClub = i === histCount - 1
      ? sr(seed, 20 + i) < 0.7   // oldest season: 70% chance different club
      : sr(seed, 20 + i) < 0.3   // recent past: 30% chance different club

    let histTeam: CareerTeam

    if (changingClub) {
      // Pick a team not yet used
      let attempts = 0
      let idx = pickIdx(PL_TEAMS.length, seed, 30 + i)
      while (usedTeamIds.has(PL_TEAMS[idx].id) && attempts < 10) {
        idx = (idx + 1) % PL_TEAMS.length
        attempts++
      }
      histTeam = PL_TEAMS[idx]
      usedTeamIds.add(histTeam.id)
    } else {
      histTeam = currentSeason.team
    }

    // Historical stats: variation around the base, slightly regressed
    const ageFactor   = 1 - seasonOffset * 0.04  // older seasons slightly weaker
    const variability = 0.7 + sr(seed, 40 + i) * 0.6

    const histGoals   = Math.round(Math.max(0, baseGoals   * ageFactor * variability))
    const histAssists = Math.round(Math.max(0, baseAssists * ageFactor * variability))
    const histMatches = iRange(20, 38, seed, 50 + i)
    const histXG      = +(Math.max(0, baseXG   * ageFactor * variability)).toFixed(2)
    const histXA      = +(Math.max(0, baseXA   * ageFactor * variability)).toFixed(2)
    const histMinutes = histMatches * iRange(60, 92, seed, 60 + i)

    // Competition: mostly PL, occasionally a different league
    const compIdx     = sr(seed, 70 + i) < 0.8 ? 0 : pickIdx(COMPETITIONS.length, seed, 80 + i)

    historicalSeasons.push({
      year:          yearLabel,
      team:          histTeam,
      competition:   COMPETITIONS[compIdx],
      matchesPlayed: histMatches,
      minutesPlayed: histMinutes,
      goals:         histGoals,
      assists:       histAssists,
      yellowCards:   iRange(0, 8, seed, 90 + i),
      redCards:      sr(seed, 100 + i) < 0.12 ? 1 : 0,
      xG:            histXG,
      xA:            histXA,
      avgRating:     rRange(5.8, 8.4, seed, 110 + i),
      isCurrent:     false,
    })
  }

  // All seasons: oldest → newest → current
  const allSeasons = [...historicalSeasons, currentSeason]

  // Career totals
  const totalMatches  = allSeasons.reduce((s, x) => s + x.matchesPlayed, 0)
  const totalGoals    = allSeasons.reduce((s, x) => s + x.goals, 0)
  const totalAssists  = allSeasons.reduce((s, x) => s + x.assists, 0)
  const totalMinutes  = allSeasons.reduce((s, x) => s + x.minutesPlayed, 0)
  const careerAvgRating = +(allSeasons.reduce((s, x) => s + x.avgRating, 0) / allSeasons.length).toFixed(2)

  // Peak season by goals (non-current preferred for storytelling)
  const peakSeason = [...allSeasons].sort((a, b) => b.goals - a.goals)[0] ?? null

  const milestones  = buildMilestones(allSeasons, playerId, position)
  const clubHistory = buildClubHistory(allSeasons)

  return {
    playerId,
    totalSeasons:  allSeasons.length,
    totalMatches,
    totalGoals,
    totalAssists,
    totalMinutes,
    seasons:       allSeasons,
    milestones,
    clubHistory,
    peakSeason,
    careerAvgRating,
  }
}

