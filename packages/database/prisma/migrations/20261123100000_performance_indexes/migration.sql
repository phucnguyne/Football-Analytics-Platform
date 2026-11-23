-- CreateIndex
CREATE INDEX "matches_status_utcDate_idx" ON "matches"("status", "utcDate");

-- CreateIndex
CREATE INDEX "player_stats_seasonId_idx" ON "player_stats"("seasonId");
