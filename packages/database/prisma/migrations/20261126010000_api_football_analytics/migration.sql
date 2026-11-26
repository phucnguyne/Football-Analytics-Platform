ALTER TABLE "players" ADD COLUMN "apiFootballId" INTEGER;
ALTER TABLE "matches" ADD COLUMN "apiFootballId" INTEGER;
CREATE UNIQUE INDEX "players_apiFootballId_key" ON "players"("apiFootballId");
CREATE UNIQUE INDEX "matches_apiFootballId_key" ON "matches"("apiFootballId");

CREATE TABLE "api_football_player_seasons" (
    "playerId" INTEGER NOT NULL REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "teamId" INTEGER NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "seasonId" INTEGER NOT NULL REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "metrics" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    PRIMARY KEY ("playerId", "teamId", "seasonId")
);
CREATE INDEX "api_football_player_seasons_teamId_seasonId_idx" ON "api_football_player_seasons"("teamId", "seasonId");
ALTER TABLE "api_football_player_seasons" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "api_football_player_seasons" FROM PUBLIC;
DO $$
DECLARE client_role text;
BEGIN
    FOR client_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated') LOOP
        EXECUTE format('REVOKE ALL ON TABLE public.api_football_player_seasons FROM %I', client_role);
    END LOOP;
END;
$$;
