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
  result: "W" | "D" | "L";
  score: string; // e.g. "2 - 1"
  minutes: number;
  rating: number; // e.g. 7.6
  goals: number;
  assists: number;
  xG: number;
  xA: number;
  keyPasses: number;
  tackles: number;
}

export interface FormSummary {
  avgRating: number;
  trend: "UP" | "DOWN" | "STABLE";
  formBadge: string;
  last5Rating: number;
  totalGoalsLast5: number;
  totalAssistsLast5: number;
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
  };
  similarityScore: number; // 0 to 100 (%)
  styleTags: string[];
  stats: {
    goals: number;
    assists: number;
    xG: number;
    xA: number;
    passCompletion: number;
    progressivePasses: number;
    tacklesPer90: number;
  };
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
};

/**
 * Calculate statistical cosine similarity between two players
 */
export function calculateCosineSimilarity(statsA: any, statsB: any): number {
  if (!statsA || !statsB) return 50;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const [key, config] of Object.entries(STAT_WEIGHTS)) {
    const valA = ((statsA[key] ?? 0) / config.max) * config.weight;
    const valB = ((statsB[key] ?? 0) / config.max) * config.weight;

    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }

  if (normA === 0 || normB === 0) return 50;

  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  // Rescale similarity to 60-99% range for natural UI presentation
  const percentage = Math.min(99, Math.max(55, Math.round(similarity * 100)));
  return percentage;
}

/**
 * Assign tactical playing style tags based on player metrics
 */
export function getPlayerStyleTags(stats: any): string[] {
  if (!stats) return ["Versatile"];
  const tags: string[] = [];

  if ((stats.xG ?? 0) > 0.35) tags.push("Goal Threat");
  if ((stats.xA ?? 0) > 0.22) tags.push("Elite Creator");
  if ((stats.progressivePasses ?? 0) > 4.5) tags.push("Ball Progressor");
  if ((stats.tacklesPer90 ?? 0) > 2.2) tags.push("High Pressing");
  if ((stats.dribblesSuccess ?? 0) > 60) tags.push("Dynamic Dribbler");
  if ((stats.interceptions ?? 0) > 1.8) tags.push("Ball Winner");
  if ((stats.passCompletion ?? 0) > 85) tags.push("Possession Anchor");

  if (tags.length === 0) tags.push("Box-to-Box Engine", "Team Player");
  return tags.slice(0, 3);
}

/**
 * Generate automated qualitative comparative verdict between two players
 */
export function generateComparisonVerdict(playerA: any, playerB: any) {
  const sA = playerA.stats || {};
  const sB = playerB.stats || {};

  const insights: string[] = [];

  if ((sA.xG ?? 0) > (sB.xG ?? 0) + 0.1) {
    insights.push(
      `${playerA.name} carries higher expected goal threat (${sA.xG?.toFixed(2)} vs ${sB.xG?.toFixed(2)} xG).`,
    );
  } else if ((sB.xG ?? 0) > (sA.xG ?? 0) + 0.1) {
    insights.push(
      `${playerB.name} provides superior direct goal threat (${sB.xG?.toFixed(2)} vs ${sA.xG?.toFixed(2)} xG).`,
    );
  }

  if ((sA.progressivePasses ?? 0) > (sB.progressivePasses ?? 0) + 1.2) {
    insights.push(
      `${playerA.name} is significantly more progressive in passing build-up (${sA.progressivePasses?.toFixed(1)} vs ${sB.progressivePasses?.toFixed(1)}/90).`,
    );
  } else if ((sB.progressivePasses ?? 0) > (sA.progressivePasses ?? 0) + 1.2) {
    insights.push(
      `${playerB.name} excels at advancing play with progressive passes (${sB.progressivePasses?.toFixed(1)} vs ${sA.progressivePasses?.toFixed(1)}/90).`,
    );
  }

  if ((sA.tacklesPer90 ?? 0) > (sB.tacklesPer90 ?? 0) + 0.8) {
    insights.push(
      `${playerA.name} offers greater defensive engagement with ${sA.tacklesPer90?.toFixed(1)} tackles/90.`,
    );
  } else if ((sB.tacklesPer90 ?? 0) > (sA.tacklesPer90 ?? 0) + 0.8) {
    insights.push(
      `${playerB.name} provides stronger defensive disruption (${sB.tacklesPer90?.toFixed(1)} tackles/90).`,
    );
  }

  if (insights.length === 0) {
    insights.push(
      `Both players exhibit closely matched statistical profiles with complementary tactical roles.`,
    );
  }

  return {
    headline: `${playerA.name} vs ${playerB.name} Tactical Scouting Matchup`,
    bullets: insights,
  };
}
