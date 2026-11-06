import "server-only";

// ---------------------------------------------------------------------------
// HuggingFace StatsBomb Open Data client
//
// Dataset: phucnguyne/statsbomb-open-data (private)
// URL pattern: HF_DATASET_URL/events/{matchId}.json
//              HF_DATASET_URL/lineups/{matchId}.json
//              HF_DATASET_URL/matches/{competitionId}/{seasonId}.json
//              HF_DATASET_URL/competitions.json
// ---------------------------------------------------------------------------

const HF_TOKEN = process.env.HF_TOKEN ?? "";
const HF_DATASET_URL =
  process.env.HF_DATASET_URL ??
  "https://huggingface.co/datasets/phucnguyne/statsbomb-open-data/resolve/main/data";
const HF_API_URL =
  "https://huggingface.co/api/datasets/phucnguyne/statsbomb-open-data/tree/main/data";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StatsBombEvent {
  id?: string;
  index?: number;
  period?: number;
  timestamp?: string;
  minute?: number;
  second?: number;
  type?: { id?: number; name?: string };
  team?: { id?: number; name?: string };
  player?: { id?: number; name?: string };
  position?: { id?: number; name?: string };
  location?: number[];
  duration?: number;
  shot?: {
    statsbomb_xg?: number;
    end_location?: number[];
    outcome?: { id?: number; name?: string };
    technique?: { name?: string };
    body_part?: { name?: string };
    type?: { name?: string };
    first_time?: boolean;
    one_on_one?: boolean;
  };
  pass?: {
    recipient?: { id?: number; name?: string };
    length?: number;
    angle?: number;
    end_location?: number[];
    technique?: { name?: string };
    body_part?: { name?: string };
    outcome?: { name?: string };
    goal_assist?: boolean;
  };
  carry?: { end_location?: number[] };
  duel?: { type?: { name?: string }; outcome?: { name?: string } };
  foul_committed?: { card?: { name?: string } };
  substitution?: { replacement?: { id?: number; name?: string } };
  related_events?: string[];
  under_pressure?: boolean;
  counterpress?: boolean;
}

export interface StatsBombLineupPlayer {
  player_id: number;
  player_name: string;
  player_nickname?: string;
  jersey_number: number;
  country?: { id: number; name: string };
  position?: { id: number; name: string };
  cards?: Array<{
    time?: string;
    card_type?: string;
    period?: number;
    reason?: string;
  }>;
}

export interface StatsBombLineup {
  team_id: number;
  team_name: string;
  lineup: StatsBombLineupPlayer[];
}

export interface StatsBombMatch {
  match_id: number;
  match_date: string;
  kick_off?: string;
  competition: {
    competition_id: number;
    country_name: string;
    competition_name: string;
  };
  season: { season_id: number; season_name: string };
  home_team: {
    home_team_id: number;
    home_team_name: string;
    home_team_gender?: string;
    managers?: Array<{
      id: number;
      name: string;
      nickname?: string;
      dob?: string;
    }>;
  };
  away_team: {
    away_team_id: number;
    away_team_name: string;
    away_team_gender?: string;
    managers?: Array<{
      id: number;
      name: string;
      nickname?: string;
      dob?: string;
    }>;
  };
  home_score?: number;
  away_score?: number;
  match_status?: string;
  match_week?: number;
  competition_stage?: { id: number; name: string };
  stadium?: { id: number; name: string };
  referee?: { id: number; name: string };
}

export interface StatsBombCompetition {
  competition_id: number;
  season_id: number;
  country_name: string;
  competition_name: string;
  competition_gender: string;
  competition_youth: boolean;
  competition_international: boolean;
  season_name: string;
  match_available?: string;
  match_available_360?: string;
}

export interface ShotPoint {
  x: number;
  y: number;
  xG: number;
  outcome: string;
  player: string;
  playerId: number;
  minute: number;
  technique?: string;
  bodyPart?: string;
  isGoal: boolean;
}

export interface StatsBombTeamTacticalMetrics {
  passes: number;
  completedPasses: number;
  passCompletion: number;
  pressures: number;
  defensiveActions: number;
  ppda: number | null;
  passesInOpponentHalf: number;
  carries: number;
  shots: number;
  xG: number;
}

// ---------------------------------------------------------------------------
// Simple in-memory LRU cache (max 60 entries, evict oldest)
// ---------------------------------------------------------------------------

class LRUCache<V> {
  private map = new Map<string, V>();
  constructor(private maxSize: number) {}

  get(key: string): V | undefined {
    const val = this.map.get(key);
    if (val !== undefined) {
      // Refresh recency
      this.map.delete(key);
      this.map.set(key, val);
    }
    return val;
  }

  set(key: string, val: V): void {
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= this.maxSize) {
      // Evict oldest
      const firstKey = this.map.keys().next().value;
      if (firstKey !== undefined) this.map.delete(firstKey);
    }
    this.map.set(key, val);
  }
}

const eventCache = new LRUCache<StatsBombEvent[]>(60);
const lineupCache = new LRUCache<StatsBombLineup[]>(60);
const matchCache = new LRUCache<StatsBombMatch[]>(30);

// ---------------------------------------------------------------------------
// Core fetch helper
// ---------------------------------------------------------------------------

function hfHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "User-Agent": "football-analytics-platform/1.0",
  };
  if (HF_TOKEN) {
    headers["Authorization"] = `Bearer ${HF_TOKEN}`;
  }
  return headers;
}

async function hfFetchJson<T>(path: string): Promise<T | null> {
  if (!HF_TOKEN) return null;
  try {
    const url = `${HF_DATASET_URL}/${path}`;
    const res = await fetch(url, {
      headers: hfHeaders(),
      // Next.js: cache for 1 hour, revalidate in background
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      if (res.status === 404) return null;
      console.warn(
        `[StatsBomb] fetch ${path}: ${res.status} ${res.statusText}`,
      );
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[StatsBomb] fetch error ${path}:`, err);
    return null;
  }
}

async function hfListDir(
  subpath: string,
): Promise<{ path: string; type: string }[]> {
  if (!HF_TOKEN) return [];
  try {
    const url = `${HF_API_URL}/${subpath}`;
    const res = await fetch(url, {
      headers: hfHeaders(),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    return (await res.json()) as { path: string; type: string }[];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Public API — Events
// ---------------------------------------------------------------------------

export async function readStatsBombEvents(
  matchId: number,
): Promise<StatsBombEvent[]> {
  const key = `events:${matchId}`;
  const cached = eventCache.get(key);
  if (cached) return cached;

  const data = await hfFetchJson<StatsBombEvent[]>(`events/${matchId}.json`);
  const result = Array.isArray(data) ? data : [];
  eventCache.set(key, result);
  return result;
}

/**
 * Read events for multiple matchIds (used by player heatmap).
 * Batches fetches with concurrency limit.
 */
export async function readStatsBombEventsForMatches(
  matchIds: number[],
): Promise<StatsBombEvent[]> {
  if (matchIds.length === 0 || !HF_TOKEN) return [];
  const CONCURRENCY = 5;
  const results: StatsBombEvent[] = [];

  for (let i = 0; i < matchIds.length; i += CONCURRENCY) {
    const batch = matchIds.slice(i, i + CONCURRENCY);
    const fetched = await Promise.all(
      batch.map((id) => readStatsBombEvents(id)),
    );
    results.push(...fetched.flat());
  }

  return results;
}

/**
 * Fetch the index of all available match event file IDs.
 * Uses HF tree API — requires token.
 */
export async function fetchStatsBombMatchIds(): Promise<number[]> {
  const entries = await hfListDir("events");
  return entries
    .filter((e) => e.type === "file" && e.path.endsWith(".json"))
    .map((e) =>
      parseInt(e.path.replace("data/events/", "").replace(".json", ""), 10),
    )
    .filter((id) => !isNaN(id));
}

// ---------------------------------------------------------------------------
// Public API — Lineups
// ---------------------------------------------------------------------------

export async function readStatsBombLineups(
  matchId: number,
): Promise<StatsBombLineup[]> {
  const key = `lineups:${matchId}`;
  const cached = lineupCache.get(key);
  if (cached) return cached;

  const data = await hfFetchJson<StatsBombLineup[]>(`lineups/${matchId}.json`);
  const result = Array.isArray(data) ? data : [];
  lineupCache.set(key, result);
  return result;
}

// ---------------------------------------------------------------------------
// Public API — Matches index
// ---------------------------------------------------------------------------

export async function readStatsBombMatches(
  competitionId: number,
  seasonId: number,
): Promise<StatsBombMatch[]> {
  const key = `matches:${competitionId}:${seasonId}`;
  const cached = matchCache.get(key);
  if (cached) return cached;

  const data = await hfFetchJson<StatsBombMatch[]>(
    `matches/${competitionId}/${seasonId}.json`,
  );
  const result = Array.isArray(data) ? data : [];
  matchCache.set(key, result);
  return result;
}

// ---------------------------------------------------------------------------
// Public API — Competitions list
// ---------------------------------------------------------------------------

let competitionsCache: StatsBombCompetition[] | null = null;
export async function readStatsBombCompetitions(): Promise<
  StatsBombCompetition[]
> {
  if (competitionsCache) return competitionsCache;
  const data = await hfFetchJson<StatsBombCompetition[]>("competitions.json");
  competitionsCache = Array.isArray(data) ? data : [];
  return competitionsCache;
}

// ---------------------------------------------------------------------------
// Legacy compat — readAllStatsBombEvents (used by heatmap)
// Now fetches events for first 30 available match IDs
// ---------------------------------------------------------------------------

export async function readAllStatsBombEvents(): Promise<StatsBombEvent[]> {
  if (!HF_TOKEN) return [];
  const ids = await fetchStatsBombMatchIds();
  const limited = ids.slice(0, 30);
  return readStatsBombEventsForMatches(limited);
}

// ---------------------------------------------------------------------------
// Analytics builders
// ---------------------------------------------------------------------------

export function buildStatsBombPassingNetwork(events: StatsBombEvent[]) {
  const nodes = new Map<
    number,
    { id: number; name: string; touches: number; x: number; y: number }
  >();
  const links = new Map<
    string,
    { source: number; target: number; count: number }
  >();

  for (const event of events) {
    const playerId = event.player?.id;
    if (!playerId) continue;
    const location = event.location ?? [60, 40];
    const node = nodes.get(playerId) ?? {
      id: playerId,
      name: event.player?.name ?? "Unknown",
      touches: 0,
      x: 0,
      y: 0,
    };
    node.touches += 1;
    node.x += location[0] ?? 60;
    node.y += location[1] ?? 40;
    nodes.set(playerId, node);

    const recipientId = event.pass?.recipient?.id;
    if (event.type?.name === "Pass" && recipientId) {
      const key = `${playerId}:${recipientId}`;
      const link = links.get(key) ?? {
        source: playerId,
        target: recipientId,
        count: 0,
      };
      link.count += 1;
      links.set(key, link);
    }
  }

  return {
    nodes: [...nodes.values()].map((n) => ({
      ...n,
      x: +(n.x / n.touches).toFixed(1),
      y: +(n.y / n.touches).toFixed(1),
    })),
    links: [...links.values()],
  };
}

export function buildStatsBombHeatmap(
  events: StatsBombEvent[],
  playerId: number,
): { x: number; y: number; intensity: number }[] {
  // StatsBomb pitch: 120x80 yards → normalize to 100x100
  return events
    .filter(
      (e) =>
        e.player?.id === playerId &&
        Array.isArray(e.location) &&
        e.location.length >= 2,
    )
    .map((e) => ({
      x: Math.round(((e.location![0] ?? 60) / 120) * 100),
      y: Math.round(((e.location![1] ?? 40) / 80) * 100),
      intensity: 1,
    }));
}

export function buildStatsBombShotMap(events: StatsBombEvent[]): ShotPoint[] {
  return events
    .filter(
      (e) =>
        e.type?.name === "Shot" &&
        Array.isArray(e.location) &&
        e.location.length >= 2,
    )
    .map((e) => {
      const outcome = e.shot?.outcome?.name ?? "Unknown";
      return {
        // Normalize from StatsBomb 120x80 → percentage of pitch
        x: Math.round(((e.location![0] ?? 100) / 120) * 100),
        y: Math.round(((e.location![1] ?? 40) / 80) * 100),
        xG: e.shot?.statsbomb_xg ?? 0,
        outcome,
        player: e.player?.name ?? "Unknown",
        playerId: e.player?.id ?? 0,
        minute: e.minute ?? 0,
        technique: e.shot?.technique?.name,
        bodyPart: e.shot?.body_part?.name,
        isGoal: outcome === "Goal",
      };

      export function buildStatsBombTeamTacticalMetrics(
        events: StatsBombEvent[],
        teamId: number,
      ): StatsBombTeamTacticalMetrics {
        const teamEvents = events.filter((event) => event.team?.id === teamId);
        const passes = teamEvents.filter(
          (event) => event.type?.name === "Pass",
        );
        const completedPasses = passes.filter((event) => !event.pass?.outcome);
        const defensiveActions = teamEvents.filter((event) =>
          ["Pressure", "Tackle", "Interception", "Block", "Clearance"].includes(
            event.type?.name ?? "",
          ),
        ).length;
        const passesInOpponentHalf = passes.filter(
          (event) => (event.location?.[0] ?? 0) >= 60,
        ).length;
        const shots = teamEvents.filter((event) => event.type?.name === "Shot");

        return {
          passes: passes.length,
          completedPasses: completedPasses.length,
          passCompletion:
            passes.length > 0
              ? +((completedPasses.length / passes.length) * 100).toFixed(1)
              : 0,
          pressures: teamEvents.filter(
            (event) => event.type?.name === "Pressure",
          ).length,
          defensiveActions,
          ppda:
            defensiveActions > 0
              ? +(passesInOpponentHalf / defensiveActions).toFixed(1)
              : null,
          passesInOpponentHalf,
          carries: teamEvents.filter((event) => event.type?.name === "Carry")
            .length,
          shots: shots.length,
          xG: +shots
            .reduce((sum, event) => sum + (event.shot?.statsbomb_xg ?? 0), 0)
            .toFixed(2),
        };
      }
    });
}

export interface PlayerFormEntry {
  minute: number;
  type: string;
  xG?: number;
  outcome?: string;
}

/** Aggregate per-event stats for a single player from match events */
export function buildStatsBombPlayerForm(
  events: StatsBombEvent[],
  playerId: number,
): PlayerFormEntry[] {
  return events
    .filter((e) => e.player?.id === playerId)
    .filter((e) =>
      ["Shot", "Goal", "Yellow Card", "Red Card"].includes(e.type?.name ?? ""),
    )
    .map((e) => ({
      minute: e.minute ?? 0,
      type: e.type?.name ?? "Unknown",
      xG: e.shot?.statsbomb_xg,
      outcome: e.shot?.outcome?.name,
    }));
}
