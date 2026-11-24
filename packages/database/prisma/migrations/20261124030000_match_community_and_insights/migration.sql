BEGIN;
CREATE TABLE "match_comments" (
  "id" SERIAL PRIMARY KEY,
  "matchId" INTEGER NOT NULL REFERENCES "matches"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  "body" VARCHAR(1000) NOT NULL CHECK (length(btrim("body")) > 0),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "match_comments_matchId_id_idx" ON "match_comments"("matchId", "id");
CREATE INDEX "match_comments_userId_createdAt_idx" ON "match_comments"("userId", "createdAt");

CREATE TABLE "match_insights" (
  "matchId" INTEGER NOT NULL REFERENCES "matches"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  "kind" TEXT NOT NULL,
  "locale" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "text" TEXT,
  "model" TEXT,
  "generatedAt" TIMESTAMP(3),
  "retryAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("matchId", "kind", "locale")
);
CREATE TABLE "insight_budget" ("day" DATE PRIMARY KEY, "attempts" INTEGER NOT NULL);

ALTER TABLE "match_comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "match_insights" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "insight_budget" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "match_comments", "match_insights", "insight_budget", "match_comments_id_seq" FROM PUBLIC;
DO $$
DECLARE client_role text;
BEGIN
  FOR client_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated') LOOP
    EXECUTE format('REVOKE ALL ON "match_comments", "match_insights", "insight_budget", "match_comments_id_seq" FROM %I', client_role);
  END LOOP;
END
$$;
COMMIT;
