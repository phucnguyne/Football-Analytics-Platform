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
      { headers: { "X-Auth-Token": footballDataApiKey }, redirect: "error" },
    );
    if (!providerResponse.ok) {
      throw new Error(
        `football-data.org returned ${providerResponse.status}`,
      );
    }

    const providerData = await providerResponse.json();
    const providerMatches = providerData.matches ?? [];
    const providerIds = providerMatches.map((match: any) => Number(match.id));
    if (providerIds.length === 0) {
      await dispatchMatchPush();
      return Response.json({ ok: true, processed: 0 });
    }

    const { data: existingMatches, error: matchQueryError } = await admin
      .from("matches")
      .select('id,status,minute,"homeTeamId","awayTeamId"')
      .in("id", providerIds);
    if (matchQueryError) throw matchQueryError;

    const { data: existingScores, error: scoreQueryError } = await admin
      .from("match_scores")
      .select('id,"matchId","homeTeamGoals","awayTeamGoals",winner')
      .in("matchId", providerIds);
    if (scoreQueryError) throw scoreQueryError;

    const matchById = new Map(
      (existingMatches ?? []).map((match: any) => [Number(match.id), match]),
    );
    const scoreByMatchId = new Map(
      (existingScores ?? []).map((score: any) => [Number(score.matchId), score]),
    );
    let processed = 0;
    let changed = 0;

    for (const providerMatch of providerMatches) {
      const id = Number(providerMatch.id);
      const existing = matchById.get(id) as any;
      if (!existing) continue; // Initial season import is done by db:sync-current/db:seed.

      const status = statusMap[providerMatch.status] ?? "SCHEDULED";
      const oldScore = scoreByMatchId.get(id) as any;
      const homeGoals = providerMatch.score?.fullTime?.home;
      const awayGoals = providerMatch.score?.fullTime?.away;
      const hasFullTimeScore = Number.isInteger(homeGoals) && Number.isInteger(awayGoals);
      const minute = providerMatch.minute ?? null;
      const winner = winnerMap[providerMatch.score?.winner] ?? null;
      const shouldUpdateScore = hasFullTimeScore && (
        oldScore?.homeTeamGoals !== homeGoals || oldScore?.awayTeamGoals !== awayGoals || oldScore?.winner !== winner
      );
      const shouldUpdateMatch = existing.status !== status || existing.minute !== minute;

      if (shouldUpdateMatch) {
        const { error } = await admin.from("matches").update({
          status,
          minute,
          lastUpdated: new Date().toISOString(),
        }).eq("id", id);
        if (error) throw error;
        changed++;
      }

      if (hasFullTimeScore && (shouldUpdateScore || shouldUpdateMatch)) {
        const { error } = await admin.from("match_scores").upsert({
          id: oldScore?.id ?? crypto.randomUUID(),
          matchId: id,
          homeTeamGoals: homeGoals,
          awayTeamGoals: awayGoals,
          homeTeamGoalsHT: providerMatch.score?.halfTime?.home ?? null,
          awayTeamGoalsHT: providerMatch.score?.halfTime?.away ?? null,
          winner,
          duration: durationMap[providerMatch.score?.duration] ?? null,
        }, { onConflict: "matchId" });
        if (error) throw error;
        if (shouldUpdateScore) changed++;
      }

      processed++;
    }

    await dispatchMatchPush();
    return Response.json({ ok: true, processed, changed, date: today });
  } catch (error) {
    console.error("live sync failed", error);
    return Response.json(
      { error: "sync failed" },
      { status: 500 },
    );
  }
});
