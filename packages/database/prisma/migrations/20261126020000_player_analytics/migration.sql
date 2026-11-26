-- CreateEnum
CREATE TYPE "PlayerMatchSource" AS ENUM ('HIGHLIGHTLY', 'API_FOOTBALL');

-- CreateEnum
CREATE TYPE "PlayerPitchSource" AS ENUM ('WYSCOUT_OPEN_DATA', 'UNDERSTAT_SHOTS');

-- CreateTable
CREATE TABLE "player_match_stats" (
    "matchId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "source" "PlayerMatchSource" NOT NULL,
    "minutes" INTEGER NOT NULL,
    "rating" DOUBLE PRECISION,
    "goals" INTEGER,
    "assists" INTEGER,
    "xG" DOUBLE PRECISION,
    "xA" DOUBLE PRECISION,
    "shots" INTEGER,
    "passes" INTEGER,
    "passesCompleted" INTEGER,
    "keyPasses" INTEGER,
    "tackles" INTEGER,
    "interceptions" INTEGER,
    "dribbles" INTEGER,
    "dribblesCompleted" INTEGER,

    CONSTRAINT "player_match_stats_pkey" PRIMARY KEY ("matchId","playerId","source")
);

-- CreateTable
CREATE TABLE "player_pitch_points" (
    "source" "PlayerPitchSource" NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalMatchId" TEXT NOT NULL,
    "playerId" INTEGER NOT NULL,
    "season" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "xG" DOUBLE PRECISION,

    CONSTRAINT "player_pitch_points_pkey" PRIMARY KEY ("source","externalId")
);

-- CreateIndex
CREATE INDEX "player_match_stats_playerId_source_idx" ON "player_match_stats"("playerId", "source");

-- CreateIndex
CREATE INDEX "player_pitch_points_playerId_source_season_date_idx" ON "player_pitch_points"("playerId", "source", "season", "date");

-- AddForeignKey
ALTER TABLE "player_match_stats" ADD CONSTRAINT "player_match_stats_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_match_stats" ADD CONSTRAINT "player_match_stats_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_pitch_points" ADD CONSTRAINT "player_pitch_points_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "player_match_stats" ADD CONSTRAINT "player_match_stats_minutes_check" CHECK ("minutes" > 0 AND "minutes" <= 130);
ALTER TABLE "player_pitch_points" ADD CONSTRAINT "player_pitch_points_coordinates_check" CHECK (x BETWEEN 0 AND 100 AND y BETWEEN 0 AND 100);

ALTER TABLE "player_match_stats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_pitch_points" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "player_match_stats", "player_pitch_points" FROM PUBLIC;
DO $$
DECLARE client_role text;
BEGIN
    FOR client_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated') LOOP
        EXECUTE format('REVOKE ALL ON public.player_match_stats, public.player_pitch_points FROM %I', client_role);
    END LOOP;
END;
$$;
