import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { getSeasonPrediction } from "@/services/season-prediction.service";

const privateHeaders = { "Cache-Control": "private, no-store" };
const loadForecast = unstable_cache(getSeasonPrediction, ["season-forecast"], { revalidate: 300 });

export async function GET() {
  if (!(await getUserId())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: privateHeaders });
  }
  try {
    const result = await loadForecast();
    return NextResponse.json(result.data, { status: result.status, headers: privateHeaders });
  } catch (error) {
    console.error("Prediction error:", error);
    return NextResponse.json(
      { error: "Could not load real Premier League data from Football-data.org" },
      { status: 502, headers: privateHeaders },
    );
  }
}
