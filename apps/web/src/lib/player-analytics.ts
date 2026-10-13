export interface FormMatch {
  matchId: number
  date: string
  opponent: {
    id: number
    name: string
    shortName: string
    crest?: string
  }
  isHome: boolean
  result: 'W' | 'D' | 'L'
  score: string // e.g. "2 - 1"
  minutes: number
  rating: number // e.g. 7.6
  goals: number
  assists: number
  xG: number
  xA: number
  keyPasses: number
  tackles: number
}

export interface FormSummary {
  avgRating: number
  trend: 'UP' | 'DOWN' | 'STABLE'
  formBadge: string
  last5Rating: number
  totalGoalsLast5: number
  totalAssistsLast5: number
}

export interface SimilarPlayerResult {
  id: number
  name: string
  position: string
  nationality?: string
  shirtNumber?: number
  team: {
    id: number
    name: string
    shortName: string
    crest?: string
  }
  similarityScore: number // 0 to 100 (%)
  styleTags: string[]
  stats: {
    goals: number
    assists: number
    xG: number
    xA: number
    passCompletion: number
    progressivePasses: number
    tacklesPer90: number
  }
}

// Pseudo-random deterministic generator based on seed
function seededRandom(seed: number) {
  const s = Math.sin(seed++) * 10000
  return s - Math.floor(s)
}

const PREMIER_LEAGUE_OPPONENTS = [
  { id: 64, name: 'Liverpool FC', shortName: 'Liverpool', crest: 'https://crests.football-data.org/64.png' },
  { id: 65, name: 'Manchester City FC', shortName: 'Man City', crest: 'https://crests.football-data.org/65.png' },
  { id: 57, name: 'Arsenal FC', shortName: 'Arsenal', crest: 'https://crests.football-data.org/57.png' },
  { id: 61, name: 'Chelsea FC', shortName: 'Chelsea', crest: 'https://crests.football-data.org/61.png' },
  { id: 66, name: 'Manchester United FC', shortName: 'Man Utd', crest: 'https://crests.football-data.org/66.png' },
  { id: 73, name: 'Tottenham Hotspur FC', shortName: 'Spurs', crest: 'https://crests.football-data.org/73.png' },
  { id: 67, name: 'Newcastle United FC', shortName: 'Newcastle', crest: 'https://crests.football-data.org/67.png' },
  { id: 58, name: 'Aston Villa FC', shortName: 'Aston Villa', crest: 'https://crests.football-data.org/58.png' },
  { id: 397, name: 'Brighton & Hove Albion FC', shortName: 'Brighton', crest: 'https://crests.football-data.org/397.png' },
  { id: 402, name: 'Brentford FC', shortName: 'Brentford', crest: 'https://crests.football-data.org/402.png' },
]

/**
 * Generate 8-10 recent match performances for a player
 */
export function generatePlayerForm(playerId: number, baseStats: any): { matches: FormMatch[]; summary: FormSummary } {
  const baseSeed = playerId * 31
  const matchCount = 8
  const matches: FormMatch[] = []

  const xgPerMatch = (baseStats?.xG ?? 0.25) / 1.2
  const xaPerMatch = (baseStats?.xA ?? 0.18) / 1.2

  let ratingSum = 0

  for (let i = 0; i < matchCount; i++) {
    const seed = baseSeed + i * 17
    const oppIdx = (playerId + i) % PREMIER_LEAGUE_OPPONENTS.length
    const opp = PREMIER_LEAGUE_OPPONENTS[oppIdx]
    const isHome = seededRandom(seed + 1) > 0.5

    const goalsScored = seededRandom(seed + 2) < (xgPerMatch * 1.3) ? (seededRandom(seed + 3) > 0.8 ? 2 : 1) : 0
    const assistsMade = seededRandom(seed + 4) < (xaPerMatch * 1.3) ? 1 : 0
    const matchXg = Math.max(0.02, xgPerMatch * (0.4 + seededRandom(seed + 5) * 1.4))
    const matchXa = Math.max(0.01, xaPerMatch * (0.4 + seededRandom(seed + 6) * 1.4))
    const minutes = seededRandom(seed + 7) > 0.15 ? Math.floor(75 + seededRandom(seed + 8) * 18) : Math.floor(45 + seededRandom(seed + 9) * 30)

    // Match Rating: 6.0 to 8.8 based on goals/assists/minutes
    let matchRating = 6.4 + seededRandom(seed + 10) * 1.1 + goalsScored * 0.9 + assistsMade * 0.5
    if (minutes < 60) matchRating -= 0.3
    matchRating = Math.min(9.4, Math.max(5.8, parseFloat(matchRating.toFixed(1))))
    ratingSum += matchRating

    // Result
    const resRandom = seededRandom(seed + 11)
    const result: 'W' | 'D' | 'L' = resRandom > 0.55 ? 'W' : resRandom > 0.25 ? 'D' : 'L'
    const teamGoals = result === 'W' ? (goalsScored > 1 ? goalsScored + 1 : 2) : result === 'D' ? 1 : 0
    const oppGoals = result === 'W' ? Math.max(0, teamGoals - 1 - Math.floor(seededRandom(seed + 12))) : result === 'D' ? 1 : 2

    const dateObj = new Date()
    dateObj.setDate(dateObj.getDate() - (matchCount - i) * 6)

    matches.push({
      matchId: 1000 + i,
      date: dateObj.toISOString().split('T')[0],
      opponent: opp,
      isHome,
      result,
      score: `${isHome ? teamGoals : oppGoals} - ${isHome ? oppGoals : teamGoals}`,
      minutes,
      rating: matchRating,
      goals: goalsScored,
      assists: assistsMade,
      xG: parseFloat(matchXg.toFixed(2)),
      xA: parseFloat(matchXa.toFixed(2)),
      keyPasses: Math.floor(seededRandom(seed + 13) * 4),
      tackles: Math.floor(seededRandom(seed + 14) * 5),
    })
  }

  const avgRating = parseFloat((ratingSum / matchCount).toFixed(2))
  const last5 = matches.slice(-5)
  const last5Rating = parseFloat((last5.reduce((acc, m) => acc + m.rating, 0) / 5).toFixed(2))
  const first3Rating = parseFloat((matches.slice(0, 3).reduce((acc, m) => acc + m.rating, 0) / 3).toFixed(2))

  const trend: 'UP' | 'DOWN' | 'STABLE' = last5Rating > first3Rating + 0.2 ? 'UP' : last5Rating < first3Rating - 0.2 ? 'DOWN' : 'STABLE'

  let formBadge = 'Solid Form'
  if (last5Rating >= 7.8) formBadge = '🔥 In Outstanding Form'
  else if (last5Rating >= 7.3) formBadge = '⚡ Strong Form'
  else if (last5Rating < 6.5) formBadge = '⚠️ Dip in Form'

  return {
    matches,
    summary: {
      avgRating,
      trend,
      formBadge,
      last5Rating,
      totalGoalsLast5: last5.reduce((acc, m) => acc + m.goals, 0),
      totalAssistsLast5: last5.reduce((acc, m) => acc + m.assists, 0),
    },
  }
}

// Key metrics normalized weightings for similarity
const STAT_WEIGHTS: Record<string, { max: number; weight: number }> = {
  xG: { max: 1.0, weight: 1.4 },
  xA: { max: 0.6, weight: 1.4 },
  shotsPer90: { max: 5.0, weight: 1.0 },
  passCompletion: { max: 100, weight: 1.0 },
  progressivePasses: { max: 10, weight: 1.2 },
  tacklesPer90: { max: 5.0, weight: 1.1 },
  interceptions: { max: 4.0, weight: 1.1 },
  dribblesSuccess: { max: 100, weight: 1.0 },
}

/**
 * Calculate statistical cosine similarity between two players
 */
export function calculateCosineSimilarity(statsA: any, statsB: any): number {
  if (!statsA || !statsB) return 50

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (const [key, config] of Object.entries(STAT_WEIGHTS)) {
    const valA = ((statsA[key] ?? 0) / config.max) * config.weight
    const valB = ((statsB[key] ?? 0) / config.max) * config.weight

    dotProduct += valA * valB
    normA += valA * valA
    normB += valB * valB
  }

  if (normA === 0 || normB === 0) return 50

  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  // Rescale similarity to 60-99% range for natural UI presentation
  const percentage = Math.min(99, Math.max(55, Math.round(similarity * 100)))
  return percentage
}

/**
 * Assign tactical playing style tags based on player metrics
 */
export function getPlayerStyleTags(stats: any): string[] {
  if (!stats) return ['Versatile']
  const tags: string[] = []

  if ((stats.xG ?? 0) > 0.35) tags.push('Goal Threat')
  if ((stats.xA ?? 0) > 0.22) tags.push('Elite Creator')
  if ((stats.progressivePasses ?? 0) > 4.5) tags.push('Ball Progressor')
  if ((stats.tacklesPer90 ?? 0) > 2.2) tags.push('High Pressing')
  if ((stats.dribblesSuccess ?? 0) > 60) tags.push('Dynamic Dribbler')
  if ((stats.interceptions ?? 0) > 1.8) tags.push('Ball Winner')
  if ((stats.passCompletion ?? 0) > 85) tags.push('Possession Anchor')

  if (tags.length === 0) tags.push('Box-to-Box Engine', 'Team Player')
  return tags.slice(0, 3)
}

/**
 * Generate automated qualitative comparative verdict between two players
 */
export function generateComparisonVerdict(playerA: any, playerB: any) {
  const sA = playerA.stats || {}
  const sB = playerB.stats || {}

  const insights: string[] = []

  if ((sA.xG ?? 0) > (sB.xG ?? 0) + 0.1) {
    insights.push(`${playerA.name} carries higher expected goal threat (${sA.xG?.toFixed(2)} vs ${sB.xG?.toFixed(2)} xG).`)
  } else if ((sB.xG ?? 0) > (sA.xG ?? 0) + 0.1) {
    insights.push(`${playerB.name} provides superior direct goal threat (${sB.xG?.toFixed(2)} vs ${sA.xG?.toFixed(2)} xG).`)
  }

  if ((sA.progressivePasses ?? 0) > (sB.progressivePasses ?? 0) + 1.2) {
    insights.push(`${playerA.name} is significantly more progressive in passing build-up (${sA.progressivePasses?.toFixed(1)} vs ${sB.progressivePasses?.toFixed(1)}/90).`)
  } else if ((sB.progressivePasses ?? 0) > (sA.progressivePasses ?? 0) + 1.2) {
    insights.push(`${playerB.name} excels at advancing play with progressive passes (${sB.progressivePasses?.toFixed(1)} vs ${sA.progressivePasses?.toFixed(1)}/90).`)
  }

  if ((sA.tacklesPer90 ?? 0) > (sB.tacklesPer90 ?? 0) + 0.8) {
    insights.push(`${playerA.name} offers greater defensive engagement with ${sA.tacklesPer90?.toFixed(1)} tackles/90.`)
  } else if ((sB.tacklesPer90 ?? 0) > (sA.tacklesPer90 ?? 0) + 0.8) {
    insights.push(`${playerB.name} provides stronger defensive disruption (${sB.tacklesPer90?.toFixed(1)} tackles/90).`)
  }

  if (insights.length === 0) {
    insights.push(`Both players exhibit closely matched statistical profiles with complementary tactical roles.`)
  }

  return {
    headline: `${playerA.name} vs ${playerB.name} Tactical Scouting Matchup`,
    bullets: insights,
  }
}

