import { NextResponse } from "next/server";
import { getSeasonPrediction } from "@/services/season-prediction.service";

const cacheControl = {
  standard: "public, s-maxage=300, stale-while-revalidate=600",
};

export async function GET() {
  try {
    const result = await getSeasonPrediction();
    return NextResponse.json(result.data, {
      status: result.status,
      headers: result.cache ? { "Cache-Control": cacheControl[result.cache] } : undefined,
    });
  } catch (error) {
    console.error("Prediction error:", error);
    return NextResponse.json(
      {
        error: "Could not load real Premier League data from Football-data.org",
      },
      { status: 502 },
    );
  }
}
