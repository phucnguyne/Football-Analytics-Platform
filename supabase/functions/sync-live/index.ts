import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const footballDataApiKey = Deno.env.get("FOOTBALL_DATA_API_KEY");
const footballDataApiUrl =
  Deno.env.get("FOOTBALL_DATA_API_URL") ?? "https://api.football-data.org/v4";
const syncSecret = Deno.env.get("SYNC_FUNCTION_SECRET");
const pushDispatchUrl = Deno.env.get("PUSH_DISPATCH_URL");
const pushDispatchSecret = Deno.env.get("PUSH_DISPATCH_SECRET");

async function dispatchMatchPush() {
  if (!pushDispatchUrl || !pushDispatchSecret) return;
  try {
    const response = await fetch(pushDispatchUrl, {
      method: "POST",
      redirect: "error",
      headers: { "x-push-secret": pushDispatchSecret },
      signal: AbortSignal.timeout(50_000),
    });
    if (!response.ok) console.error("Match push dispatch failed", response.status);
  } catch {
    console.error("Match push dispatch did not complete");
  }
}

if (!supabaseUrl || !serviceRoleKey || !footballDataApiKey || !syncSecret) {
  throw new Error("Missing required Supabase live-sync function secrets");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const statusMap: Record<string, string> = {
  SCHEDULED: "SCHEDULED",
  TIMED: "TIMED",
  IN_PLAY: "IN_PLAY",
  PAUSED: "PAUSED",
  FINISHED: "FINISHED",
  POSTPONED: "POSTPONED",
  CANCELLED: "CANCELLED",
  SUSPENDED: "SUSPENDED",
};

const winnerMap: Record<string, string> = {
  HOME_TEAM: "HOME",
  AWAY_TEAM: "AWAY",
  DRAW: "DRAW",
};

const durationMap: Record<string, string> = {
  REGULAR: "REGULAR",
  EXTRA_TIME: "EXTRA_TIME",
  PENALTY_SHOOTOUT: "PENALTY",
};

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return Response.json({ error: "method not allowed" }, { status: 405 });
  }
  if (request.headers.get("x-sync-secret") !== syncSecret) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const today = new Date().toISOString().slice(0, 10);
    const providerResponse = await fetch(
      `${footballDataApiUrl}/matches?date=${today}`,
      { headers: { "X-Auth-Token": footballDataApiKey }, redirect: "error", signal: AbortSignal.timeout(10_000) },
    );
    if (!providerResponse.ok) {
      throw new Error(
        `football-data.org returned ${providerResponse.status}`,
      );
    }

    const providerData: {
      matches?: {
        id: number;
        status: string;
        minute?: number | null;
        score?: {
          fullTime?: { home?: number | null; away?: number | null };
          halfTime?: { home?: number | null; away?: number | null };
          winner?: string | null;
          duration?: string | null;
        };
      }[];
    } = await providerResponse.json();
    const updates = (providerData.matches ?? []).flatMap((fixture) => {
      const status = statusMap[fixture.status];
      if (!Number.isSafeInteger(fixture.id) || fixture.id <= 0 || !status) return [];
      return [{
        match_id: fixture.id,
        status,
        minute: fixture.minute ?? null,
        score_id: crypto.randomUUID(),
        home_goals: fixture.score?.fullTime?.home ?? null,
        away_goals: fixture.score?.fullTime?.away ?? null,
        home_half: fixture.score?.halfTime?.home ?? null,
        away_half: fixture.score?.halfTime?.away ?? null,
        winner: winnerMap[fixture.score?.winner ?? ""] ?? null,
        duration: durationMap[fixture.score?.duration ?? ""] ?? null,
      }];
    });
    const result = updates.length
      ? await admin.rpc("apply_live_match_updates", { updates })
      : { data: { processed: 0, changed: 0 }, error: null };
    if (result.error) throw result.error;

    await dispatchMatchPush();
    return Response.json({ ok: true, ...result.data, date: today });
  } catch (error) {
    console.error("live sync failed", error);
    return Response.json(
      { error: "sync failed" },
      { status: 500 },
    );
  }
});
