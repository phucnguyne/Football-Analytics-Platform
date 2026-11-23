import { NextRequest, NextResponse } from "next/server";
import { searchPlayers } from "@/services/player.service";

const cacheControl = {
  short: "public, s-maxage=60, stale-while-revalidate=120",
  standard: "public, s-maxage=300, stale-while-revalidate=600",
};

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const query = searchParams.get("query")?.trim() || "";
  const parsedLimit = Number.parseInt(searchParams.get("limit") || "25", 10);
  const limit = Number.isInteger(parsedLimit)
    ? Math.min(50, Math.max(1, parsedLimit))
    : 25;
  const teamIdParam = searchParams.get("teamId");
  const teamId = teamIdParam ? Number.parseInt(teamIdParam, 10) : undefined;

  if (
    teamIdParam &&
    (teamId === undefined || !Number.isInteger(teamId) || teamId <= 0)
  ) {
    return NextResponse.json({ error: "invalid team id" }, { status: 400 });
  }

  try {
    const result = await searchPlayers({ query, limit, teamId });
    return NextResponse.json(result.data, {
      status: result.status,
      headers: result.cache ? { "Cache-Control": cacheControl[result.cache] } : undefined,
    });
  } catch (error) {
    console.error("Error querying players:", error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
