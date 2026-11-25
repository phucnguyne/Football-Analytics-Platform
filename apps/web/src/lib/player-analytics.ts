export interface FormMatch {
  matchId: number;
  date: string;
  opponent: {
    id: number;
    name: string;
    shortName: string;
    crest?: string;
  };
  isHome: boolean;
  result: "W" | "D" | "L" | null;
  score: string | null;
  minutes: number | null;
  rating: number | null;
  goals: number | null;
  assists: number | null;
  xG: number | null;
  xA: number | null;
  keyPasses: number | null;
  tackles: number | null;
}

export interface FormSummary {
  avgRating: number | null;
  trend: "UP" | "DOWN" | "STABLE" | null;
  last5Rating: number | null;
  totalGoalsLast5: number | null;
  totalAssistsLast5: number | null;
}

export interface SimilarPlayerResult {
  id: number;
  name: string;
  position: string;
  nationality?: string;
  shirtNumber?: number;
  team: {
    id: number;
    name: string;
    shortName: string;
    crest?: string;
  } | null;
  similarityScore: number; // 0 to 100 (%)
  styleTags: string[];
  stats: {
    goals: number | null;
    assists: number | null;
    xG: number | null;
    xA: number | null;
    passCompletion: number | null;
    progressivePasses: number | null;
    tacklesPer90: number | null;
  };
}

export interface PlayerPerformanceStats {
  xG?: number | null
  xA?: number | null
  shotsPer90?: number | null
  passCompletion?: number | null
  progressivePasses?: number | null
  tacklesPer90?: number | null
  interceptions?: number | null
  dribblesSuccess?: number | null
}

export interface ComparablePlayer {
  name: string
  stats?: PlayerPerformanceStats | null
}

// Key metrics normalized weightings for similarity
const STAT_WEIGHTS: Record<keyof PlayerPerformanceStats, { max: number; weight: number }> = {
  xG: { max: 1.0, weight: 1.4 },
  xA: { max: 0.6, weight: 1.4 },
  shotsPer90: { max: 5.0, weight: 1.0 },
  passCompletion: { max: 100, weight: 1.0 },
  progressivePasses: { max: 10, weight: 1.2 },
  tacklesPer90: { max: 5.0, weight: 1.1 },
  interceptions: { max: 4.0, weight: 1.1 },
  dribblesSuccess: { max: 100, weight: 1.0 },
};

/**
 * Calculate statistical cosine similarity between two players
 */
export function calculateCosineSimilarity(
  statsA?: PlayerPerformanceStats | null,
  statsB?: PlayerPerformanceStats | null,
): number | null {
  if (!statsA || !statsB) return null;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  let sharedMetrics = 0;

  for (const key of Object.keys(STAT_WEIGHTS) as Array<keyof PlayerPerformanceStats>) {
    const config = STAT_WEIGHTS[key]
    const a = statsA[key];
    const b = statsB[key];
    if (a == null || b == null) continue;
    const valA = (a / config.max) * config.weight;
    const valB = (b / config.max) * config.weight;
    sharedMetrics++;

    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }

  if (sharedMetrics < 2 || normA === 0 || normB === 0) return null;

  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return Math.round(Math.max(0, Math.min(1, similarity)) * 100);
}

/**
 * Assign tactical playing style tags based on player metrics
 */
export function getPlayerStyleTags(stats?: PlayerPerformanceStats | null): string[] {
  if (!stats) return [];
  const tags: string[] = [];

  if ((stats.xG ?? 0) > 0.35) tags.push("Goal Threat");
  if ((stats.xA ?? 0) > 0.22) tags.push("Elite Creator");
  if ((stats.progressivePasses ?? 0) > 4.5) tags.push("Ball Progressor");
  if ((stats.tacklesPer90 ?? 0) > 2.2) tags.push("High Pressing");
  if ((stats.dribblesSuccess ?? 0) > 60) tags.push("Dynamic Dribbler");
  if ((stats.interceptions ?? 0) > 1.8) tags.push("Ball Winner");
  if ((stats.passCompletion ?? 0) > 85) tags.push("Possession Anchor");

  return tags.slice(0, 3);
}

/**
 * Generate automated qualitative comparative verdict between two players
 */
export function generateComparisonVerdict(
  playerA: ComparablePlayer | null,
  playerB: ComparablePlayer | null,
) {
  if (!playerA || !playerB) {
    return { headline: 'Player comparison unavailable', bullets: ['Player data is unavailable.'] }
  }
  const sA = playerA.stats || {};
  const sB = playerB.stats || {};

  const insights: string[] = [];

  if (sA.xG != null && sB.xG != null && sA.xG > sB.xG + 0.1) {
    insights.push(
      `${playerA.name} carries higher expected goal threat (${sA.xG?.toFixed(2)} vs ${sB.xG?.toFixed(2)} xG).`,
    );
  } else if (sB.xG != null && sA.xG != null && sB.xG > sA.xG + 0.1) {
    insights.push(
      `${playerB.name} provides superior direct goal threat (${sB.xG?.toFixed(2)} vs ${sA.xG?.toFixed(2)} xG).`,
    );
  }

  if (sA.progressivePasses != null && sB.progressivePasses != null && sA.progressivePasses > sB.progressivePasses + 1.2) {
    insights.push(
      `${playerA.name} is significantly more progressive in passing build-up (${sA.progressivePasses?.toFixed(1)} vs ${sB.progressivePasses?.toFixed(1)}/90).`,
    );
  } else if (sB.progressivePasses != null && sA.progressivePasses != null && sB.progressivePasses > sA.progressivePasses + 1.2) {
    insights.push(
      `${playerB.name} excels at advancing play with progressive passes (${sB.progressivePasses?.toFixed(1)} vs ${sA.progressivePasses?.toFixed(1)}/90).`,
    );
  }

  if (sA.tacklesPer90 != null && sB.tacklesPer90 != null && sA.tacklesPer90 > sB.tacklesPer90 + 0.8) {
    insights.push(
      `${playerA.name} offers greater defensive engagement with ${sA.tacklesPer90?.toFixed(1)} tackles/90.`,
    );
  } else if (sB.tacklesPer90 != null && sA.tacklesPer90 != null && sB.tacklesPer90 > sA.tacklesPer90 + 0.8) {
    insights.push(
      `${playerB.name} provides stronger defensive disruption (${sB.tacklesPer90?.toFixed(1)} tackles/90).`,
    );
  }

  if (insights.length === 0) {
    insights.push(
      `The shared statistics do not show a clear difference on these metrics.`,
    );
  }

  return {
    headline: `${playerA.name} vs ${playerB.name} Tactical Scouting Matchup`,
    bullets: insights,
  };
}
