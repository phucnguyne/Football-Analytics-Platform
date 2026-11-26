import { measureProviderCalls } from '@/lib/provider-timing'
import { NextRequest, NextResponse } from "next/server";
import { getMatchDetail } from "@/services/match.service";

const cacheControl = {
  live: "public, s-maxage=30, stale-while-revalidate=60",
  finished: "public, s-maxage=120, stale-while-revalidate=300",
  historical: "public, s-maxage=3600, stale-while-revalidate=86400",
};

export function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return measureProviderCalls(() => loadDetail(params));
}

async function loadDetail(params: Promise<{ id: string }>) {
  const { id } = await params;
  const matchId = Number(id);

  if (!Number.isInteger(matchId) || matchId === 0) {
    return NextResponse.json({ error: "invalid match id" }, { status: 400 });
  }

  try {
    const result = await getMatchDetail(matchId);
    return NextResponse.json(result.data, {
      status: result.status,
      headers: result.cache ? { "Cache-Control": cacheControl[result.cache] } : undefined,
    });
  } catch (error) {
    console.error("Error fetching match detail:", error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
