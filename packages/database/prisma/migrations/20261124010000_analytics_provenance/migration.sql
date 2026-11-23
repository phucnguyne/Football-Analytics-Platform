CREATE TYPE "DataProvenance" AS ENUM ('REAL', 'GENERATED');
ALTER TABLE "player_stats" ADD COLUMN "dataSource" "DataProvenance";
ALTER TABLE "match_events" ADD COLUMN "analyticsSource" "DataProvenance";
