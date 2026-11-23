CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "endpoint" TEXT NOT NULL UNIQUE,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "push_subscriptions_userId_idx" ON "push_subscriptions"("userId");

CREATE TABLE "push_deliveries" (
    "subscriptionId" TEXT NOT NULL REFERENCES "push_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "eventKey" TEXT NOT NULL,
    "matchId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "homeTeam" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "homeScore" INTEGER NOT NULL,
    "awayScore" INTEGER NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    PRIMARY KEY ("subscriptionId", "eventKey")
);
CREATE INDEX "push_deliveries_sentAt_availableAt_idx" ON "push_deliveries"("sentAt", "availableAt");
CREATE INDEX "push_deliveries_createdAt_idx" ON "push_deliveries"("createdAt");

ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "push_deliveries" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "push_subscriptions", "push_deliveries" FROM PUBLIC;

-- Live sync writes the match status before the score. Capturing changes on the
-- score row makes the notification and its underlying score commit together.
CREATE FUNCTION enqueue_match_push() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
    fixture record;
    previous_home integer := 0;
    previous_away integer := 0;
    event_kind text;
    event_key text;
BEGIN
    SELECT m.status, m."homeTeamId", m."awayTeamId", h.name AS home_name, a.name AS away_name
    INTO fixture
    FROM public.matches AS m
    JOIN public.teams AS h ON h.id = m."homeTeamId"
    JOIN public.teams AS a ON a.id = m."awayTeamId"
    WHERE m.id = NEW."matchId"
      AND m."utcDate" BETWEEN (now() AT TIME ZONE 'UTC') - interval '6 hours'
                           AND (now() AT TIME ZONE 'UTC');
    IF NOT FOUND THEN RETURN NEW; END IF;

    IF fixture.status = 'FINISHED' AND NEW.winner IS NOT NULL THEN
        event_kind := 'FINAL';
        event_key := NEW."matchId" || ':final';
    ELSIF fixture.status IN ('IN_PLAY', 'PAUSED') THEN
        IF TG_OP = 'UPDATE' THEN
            previous_home := OLD."homeTeamGoals";
            previous_away := OLD."awayTeamGoals";
        END IF;
        IF NEW."homeTeamGoals" <= previous_home AND NEW."awayTeamGoals" <= previous_away THEN
            RETURN NEW;
        END IF;
        IF NEW."homeTeamGoals" + NEW."awayTeamGoals" <= previous_home + previous_away THEN
            RETURN NEW;
        END IF;
        event_kind := 'GOAL';
        event_key := NEW."matchId" || ':goal:' || NEW."homeTeamGoals" || ':' || NEW."awayTeamGoals";
    ELSE
        RETURN NEW;
    END IF;

    INSERT INTO public.push_deliveries (
        "subscriptionId", "eventKey", "matchId", "kind", "homeTeam", "awayTeam", "homeScore", "awayScore"
    )
    SELECT s.id, event_key, NEW."matchId", event_kind, fixture.home_name, fixture.away_name,
           NEW."homeTeamGoals", NEW."awayTeamGoals"
    FROM public.push_subscriptions AS s
    WHERE EXISTS (
        SELECT 1 FROM public.favorites AS f
        WHERE f."userId" = s."userId" AND f."entityType" = 'TEAM'
          AND f."entityId" IN (fixture."homeTeamId"::text, fixture."awayTeamId"::text)
    )
    ON CONFLICT ("subscriptionId", "eventKey") DO NOTHING;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION enqueue_match_push() FROM PUBLIC;
CREATE TRIGGER match_score_push AFTER INSERT OR UPDATE ON "match_scores"
FOR EACH ROW EXECUTE FUNCTION enqueue_match_push();
