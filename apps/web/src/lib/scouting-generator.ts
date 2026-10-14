/**
 * Scouting Report Generator
 *
 * Generates deterministic, analyst-grade scouting data for any team.
 * Uses a seeded PRNG so the same teamId always produces the same report.
 * Where real DB data is available it is used directly; tactical / qualitative
 * metrics are mocked realistically based on the team seed.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FormationTendency {
  home: string
  away: string
  description: string
}

export interface AttackingPattern {
  leftFlank: number   // 0-100 %
  central: number     // 0-100 %
  rightFlank: number  // 0-100 %
  style: 'Direct' | 'Possession' | 'Counter' | 'High-Press'
  avgShotsPerGame: number
  chancesCreatedPerGame: number
  setPickEfficiency: number // %
  crossesPerGame: number
}

export interface DefensiveProfile {
  ppda: number              // Passes allowed per defensive action (lower = more pressing)
  blockType: 'High' | 'Mid' | 'Low'
  defensiveLineHeight: 'Deep' | 'Mid' | 'High'
  pressIntensity: 'High' | 'Medium' | 'Low'
  cleanSheetRate: number    // %
  tacklesPerGame: number
  interceptionsPerGame: number
  aerialDuelsWon: number    // %
  weakZones: string[]       // e.g. ['Left Channel', 'High Press Vulnerability']
}

export interface SetPieceStats {
  cornersPerGame: number
  cornerConversionRate: number  // %
  freeKickGoals: number
  setPieceGoalsFor: number
  setPieceGoalsAgainst: number
  throwInStrategy: 'Short' | 'Long' | 'Mixed'
}

export interface KeyPlayerStat {
  id: number
  name: string
  position: string
  nationality?: string
  shirtNumber?: number
  goals: number
  assists: number
  xG: number
  xA: number
  passCompletion: number
  tacklesPer90: number
  progressivePasses: number
  role: string   // e.g. 'Creative Hub', 'Goal Threat', 'Press Leader'
}

export interface RecentFormEntry {
  matchday: number
  opponent: string
  opponentCrest?: string
  isHome: boolean
  result: 'W' | 'D' | 'L'
  score: string
  goalsFor: number
  goalsAgainst: number
}

export interface StrengthWeakness {
  strengths: string[]
  weaknesses: string[]
  analystNote: string
}

export interface ScoutingReport {
  teamId: number
  teamName: string
  shortName: string
  crest?: string
  venue?: string
  founded?: number

  // Stats from DB
  leaguePosition: number
  points: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  playedGames: number

  // Generated tactical data
  formationTendency: FormationTendency
  attackingPattern: AttackingPattern
  defensiveProfile: DefensiveProfile
  setPieceStats: SetPieceStats
  keyPlayers: KeyPlayerStat[]
  recentForm: RecentFormEntry[]
  strengthsWeaknesses: StrengthWeakness
  overallRating: number   // 1-10
  generatedAt: string
}

// ── Seeded PRNG ───────────────────────────────────────────────────────────────

function seeded(seed: number, offset = 0): number {
  const s = Math.sin(seed * 9301 + offset * 49297 + 233) * 49979
  return s - Math.floor(s)
}

function pick<T>(arr: T[], seed: number, offset: number): T {
  return arr[Math.floor(seeded(seed, offset) * arr.length)]
}

function range(min: number, max: number, seed: number, offset: number): number {
  return +(min + seeded(seed, offset) * (max - min)).toFixed(2)
}

function intRange(min: number, max: number, seed: number, offset: number): number {
  return Math.floor(min + seeded(seed, offset) * (max - min + 1))
}

// ── Formation library ─────────────────────────────────────────────────────────

const FORMATIONS = ['4-3-3', '4-2-3-1', '4-4-2', '3-5-2', '3-4-3', '5-3-2', '4-1-4-1', '4-5-1']
const STYLES: Array<'Direct' | 'Possession' | 'Counter' | 'High-Press'> = ['Direct', 'Possession', 'Counter', 'High-Press']

const FORMATION_DESCRIPTIONS: Record<string, string> = {
  '4-3-3':   'Aggressive width with two high wingers; relies on full-back overlaps',
  '4-2-3-1': 'Double-pivot base allows the #10 to link play between lines',
  '4-4-2':   'Classic dual-striker system; compresses central areas in defence',
  '3-5-2':   'Wing-backs provide width; physical midfield trio wins second balls',
  '3-4-3':   'High defensive line, aggressive press; vulnerable in wide channels',
  '5-3-2':   'Compact defensive structure; transitions quickly on the counter',
  '4-1-4-1': 'Single pivot frees the two 8s to box-to-box; lone striker presses',
  '4-5-1':   'Mid-block with late runners; transitions through the #10 pocket',
}

// ── Analysts' text banks ──────────────────────────────────────────────────────

const STRENGTHS_BANK = [
  'Clinical in front of goal — top-5 conversion rate in the league',
  'Exceptional set-piece delivery, scoring from both corners and free kicks',
  'High-energy press that forces turnovers in dangerous areas',
  'Strong aerial presence in both boxes; dominant at defensive corners',
  'Progressive passing through the lines; consistently breaks the first press',
  'Elite goalkeeper form — saves above expected (PSxG+/-  positive)',
  'Consistent 4-back line with short defensive line distances',
  'Dangerous from wide areas; high crossing volume with good accuracy',
  'Excellent counter-press within 5 seconds of losing possession',
  'Strong at protecting a lead — rarely concedes from a winning position',
]

const WEAKNESSES_BANK = [
  'Vulnerability in the left channel when the full-back pushes high',
  'Exposed by teams that press high — goalkeeper comfortable in possession not always reliable',
  'Over-reliance on key creator — press that man and creativity drops sharply',
  'Poor record in mid-week fixtures; fatigue factor evident',
  'Concedes late goals — defensive focus drops after 75 minutes',
  'Low aerial duel success rate, punished at defensive set pieces',
  'High PPDA in away fixtures suggests reluctance to press away from home',
  'Transition defence fragile — space behind the high defensive line exploited',
  'Limited depth in attacking positions; injuries have tactical impact',
  'Slow build-up from the back invites pressure; prone to goal-kicks under pressure',
]

const ANALYST_NOTES = [
  'A well-drilled side that rewards patience — disrupting their rhythm in the first 15 minutes is critical.',
  'Their shape is defensively sound at home but shows gaps in wide areas away from home.',
  'This team is most dangerous in the first 20 minutes — early organisation is key.',
  'Strong pressing machine; counter-pressing within 6 seconds keeps opponents pinned back.',
  'Their build-up is methodical; sustained high-press for 60+ minutes can yield results.',
  'Set pieces are a genuine weapon — marking assignments must be rehearsed in the buildup.',
]

const WEAK_ZONES = [
  'Left Channel', 'Right Channel', 'Half-Space Right', 'Half-Space Left',
  'High Press Vulnerability', 'Wide Areas in Transition', 'Defensive Corners',
  'Ball-Far Side at Set Pieces', 'Gaps Behind High Line',
]

const OPPONENT_NAMES = [
  'Arsenal', 'Chelsea', 'Liverpool', 'Manchester City', 'Manchester United',
  'Tottenham', 'Newcastle', 'Aston Villa', 'Brighton', 'Brentford',
  'West Ham', 'Fulham', 'Everton', 'Wolves', 'Crystal Palace',
  'Bournemouth', 'Nottingham Forest', 'Burnley', 'Sheffield Utd', 'Luton',
]

const PLAYER_ROLES = [
  'Creative Hub', 'Goal Threat', 'Press Leader', 'Ball Winner',
  'Progressive Carrier', 'Deep Playmaker', 'Set-Piece Specialist', 'Wide Threat',
]

// ── Main generator ────────────────────────────────────────────────────────────

export interface ScoutingInput {
  team: {
    id: number
    name: string
    shortName: string
    crest?: string | null
    venue?: string | null
    founded?: number | null
  }
  standing?: {
    position: number
    points: number
    wins: number
    draws: number
    losses: number
    goalsFor: number
    goalsAgainst: number
    goalDifference: number
    playedGames: number
  } | null
  topPlayers?: Array<{
    id: number
    name: string
    position: string
    nationality?: string | null
    shirtNumber?: number | null
    goals: number
    assists: number
    xG: number
    xA: number
    passCompletion: number
    tacklesPer90: number
    progressivePasses: number
  }>
  recentMatches?: Array<{
    matchday: number | null
    utcDate: string
    homeTeamId: number
    homeTeamName: string
    homeTeamCrest?: string | null
    awayTeamName: string
    awayTeamCrest?: string | null
    homeGoals: number | null
    awayGoals: number | null
  }>
}

export function generateScoutingReport(input: ScoutingInput): ScoutingReport {
  const { team, standing, topPlayers = [], recentMatches = [] } = input
  const seed = team.id

  // ── Formation tendency ─────────────────────────────────────────────────────
  const homeFormIdx = intRange(0, FORMATIONS.length - 1, seed, 1)
  const awayFormIdx = intRange(0, FORMATIONS.length - 1, seed, 2)
  const homeForm = FORMATIONS[homeFormIdx]
  const awayForm = FORMATIONS[awayFormIdx]

  const formationTendency: FormationTendency = {
    home: homeForm,
    away: awayForm,
    description: FORMATION_DESCRIPTIONS[homeForm] ?? 'Flexible tactical setup adapted to the opponent.',
  }

  // ── Attacking pattern ──────────────────────────────────────────────────────
  const leftFlank  = intRange(20, 45, seed, 10)
  const rightFlank = intRange(20, 45, seed, 11)
  const central    = 100 - leftFlank - rightFlank

  const attackingPattern: AttackingPattern = {
    leftFlank,
    central: Math.max(10, central),
    rightFlank,
    style: pick(STYLES, seed, 20),
    avgShotsPerGame:         range(9,  18,  seed, 21),
    chancesCreatedPerGame:   range(5,  14,  seed, 22),
    setPickEfficiency:       intRange(5, 35, seed, 23),
    crossesPerGame:          range(12, 30,  seed, 24),
  }

  // ── Defensive profile ──────────────────────────────────────────────────────
  const ppda = range(5, 18, seed, 30)
  const blockType =
    ppda < 8  ? 'High' :
    ppda < 13 ? 'Mid'  : 'Low'

  const pressIntensity =
    ppda < 8  ? 'High' :
    ppda < 13 ? 'Medium' : 'Low'

  const defensiveProfile: DefensiveProfile = {
    ppda,
    blockType,
    defensiveLineHeight: pick<'Deep' | 'Mid' | 'High'>(['Deep', 'Mid', 'High'], seed, 31),
    pressIntensity,
    cleanSheetRate:        intRange(15, 55, seed, 32),
    tacklesPerGame:        range(14, 26,   seed, 33),
    interceptionsPerGame:  range(5,  14,   seed, 34),
    aerialDuelsWon:        intRange(40, 68, seed, 35),
    weakZones: [
      pick(WEAK_ZONES, seed, 36),
      pick(WEAK_ZONES, seed, 37),
    ].filter((v, i, a) => a.indexOf(v) === i), // unique
  }

  // ── Set piece stats ────────────────────────────────────────────────────────
  const setPieceStats: SetPieceStats = {
    cornersPerGame:          range(3,   8,  seed, 40),
    cornerConversionRate:    range(2.5, 12, seed, 41),
    freeKickGoals:           intRange(0,  6, seed, 42),
    setPieceGoalsFor:        intRange(3, 15, seed, 43),
    setPieceGoalsAgainst:    intRange(2, 12, seed, 44),
    throwInStrategy:         pick<'Short' | 'Long' | 'Mixed'>(['Short', 'Long', 'Mixed'], seed, 45),
  }

  // ── Key players ────────────────────────────────────────────────────────────
  // Use real DB players if provided, otherwise synthesise 5 mocked names
  let keyPlayers: KeyPlayerStat[]

  if (topPlayers.length > 0) {
    keyPlayers = topPlayers.slice(0, 5).map((p, i) => ({
      ...p,
      nationality: p.nationality ?? undefined,
      shirtNumber: p.shirtNumber ?? undefined,
      role: pick(PLAYER_ROLES, seed + p.id, i),
    }))
  } else {
    // Fallback: synthesise 5 players when DB unavailable
    const positions = ['GOALKEEPER', 'DEFENDER', 'MIDFIELDER', 'MIDFIELDER', 'FORWARD']
    const roles     = ['Shot-Stopper', 'Ball-Playing Defender', 'Deep Playmaker', 'Progressive Carrier', 'Goal Threat']
    keyPlayers = positions.map((pos, i) => ({
      id:   seed * 100 + i,
      name: `Player ${String.fromCharCode(65 + i)} (${team.shortName})`,
      position: pos,
      role: roles[i],
      goals:             intRange(0, pos === 'FORWARD' ? 18 : 4,  seed, 50 + i),
      assists:           intRange(0, pos === 'MIDFIELDER' ? 12 : 6, seed, 60 + i),
      xG:                range(0, pos === 'FORWARD' ? 15 : 3, seed, 70 + i),
      xA:                range(0, pos === 'MIDFIELDER' ? 10 : 4, seed, 80 + i),
      passCompletion:    range(70, 95,  seed, 90 + i),
      tacklesPer90:      range(0.5, 4,  seed, 100 + i),
      progressivePasses: range(2, 12,   seed, 110 + i),
    }))
  }

  // ── Recent form ────────────────────────────────────────────────────────────
  let recentForm: RecentFormEntry[]

  if (recentMatches.length > 0) {
    recentForm = recentMatches.slice(0, 6).map(m => {
      const isHome  = m.homeTeamId === team.id
      const gf      = isHome ? (m.homeGoals ?? 0) : (m.awayGoals ?? 0)
      const ga      = isHome ? (m.awayGoals ?? 0) : (m.homeGoals ?? 0)
      const result: 'W' | 'D' | 'L' = gf > ga ? 'W' : gf === ga ? 'D' : 'L'
      const opponentName = isHome ? m.awayTeamName : m.homeTeamName
      const opponentCrest = isHome ? m.awayTeamCrest : m.homeTeamCrest

      return {
        matchday:       m.matchday ?? 0,
        opponent:       opponentName,
        opponentCrest:  opponentCrest ?? undefined,
        isHome,
        result,
        score:          `${gf} – ${ga}`,
        goalsFor:       gf,
        goalsAgainst:   ga,
      }
    })
  } else {
    // Fallback: mock last 6 results
    recentForm = Array.from({ length: 6 }, (_, i) => {
      const gf = intRange(0, 4, seed, 120 + i)
      const ga = intRange(0, 3, seed, 130 + i)
      const result: 'W' | 'D' | 'L' = gf > ga ? 'W' : gf === ga ? 'D' : 'L'
      return {
        matchday:     38 - i,
        opponent:     pick(OPPONENT_NAMES.filter(n => n !== team.name), seed, 140 + i),
        isHome:       i % 2 === 0,
        result,
        score:        `${gf} – ${ga}`,
        goalsFor:     gf,
        goalsAgainst: ga,
      }
    })
  }

  // ── Strengths & weaknesses ─────────────────────────────────────────────────
  const strIdxA = intRange(0, STRENGTHS_BANK.length - 1, seed, 150)
  const strIdxB = intRange(0, STRENGTHS_BANK.length - 1, seed, 151)
  const wkIdxA  = intRange(0, WEAKNESSES_BANK.length - 1, seed, 152)
  const wkIdxB  = intRange(0, WEAKNESSES_BANK.length - 1, seed, 153)

  const strengthsWeaknesses: StrengthWeakness = {
    strengths: [
      STRENGTHS_BANK[strIdxA],
      STRENGTHS_BANK[strIdxB !== strIdxA ? strIdxB : (strIdxB + 1) % STRENGTHS_BANK.length],
    ],
    weaknesses: [
      WEAKNESSES_BANK[wkIdxA],
      WEAKNESSES_BANK[wkIdxB !== wkIdxA ? wkIdxB : (wkIdxB + 1) % WEAKNESSES_BANK.length],
    ],
    analystNote: pick(ANALYST_NOTES, seed, 160),
  }

  // ── Overall rating — influenced by league position if available ────────────
  let overallRating: number
  if (standing) {
    // Scale: 1st = ~9.0, 20th = ~4.5
    overallRating = +(9.5 - (standing.position - 1) * 0.25 + range(-0.3, 0.3, seed, 170)).toFixed(1)
    overallRating = Math.min(10, Math.max(4, overallRating))
  } else {
    overallRating = range(5, 9, seed, 170)
  }

  return {
    teamId:    team.id,
    teamName:  team.name,
    shortName: team.shortName,
    crest:     team.crest ?? undefined,
    venue:     team.venue ?? undefined,
    founded:   team.founded ?? undefined,

    leaguePosition: standing?.position ?? 0,
    points:         standing?.points ?? 0,
    wins:           standing?.wins ?? 0,
    draws:          standing?.draws ?? 0,
    losses:         standing?.losses ?? 0,
    goalsFor:       standing?.goalsFor ?? 0,
    goalsAgainst:   standing?.goalsAgainst ?? 0,
    goalDifference: standing?.goalDifference ?? 0,
    playedGames:    standing?.playedGames ?? 0,

    formationTendency,
    attackingPattern,
    defensiveProfile,
    setPieceStats,
    keyPlayers,
    recentForm,
    strengthsWeaknesses,
    overallRating,
    generatedAt: new Date().toISOString(),
  }
}
