BEGIN;

CREATE TABLE "login_attempts" (
    "key" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "login_attempts_expiresAt_idx" ON "login_attempts"("expiresAt");

-- Browser clients subscribe directly to matches and scores. The remaining
-- application tables are accessed by server-side Prisma.
DO $$
DECLARE
    app_table TEXT;
    client_role TEXT;
    app_schema TEXT := current_schema();
BEGIN
    FOREACH app_table IN ARRAY ARRAY[
        'users', 'accounts', 'sessions', 'login_attempts', 'favorites', 'predictions',
        'leagues', 'seasons', 'teams', 'team_seasons', 'players', 'player_teams',
        'match_events', 'match_statistics', 'match_lineups', 'standings',
        'team_stats', 'player_stats', 'sync_logs', 'matches', 'match_scores'
    ] LOOP
        EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', app_schema, app_table);
        EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM PUBLIC', app_schema, app_table);

        -- These roles are absent on plain PostgreSQL installs.
        FOR client_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')
        LOOP
            EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM %I', app_schema, app_table, client_role);
            IF app_table IN ('matches', 'match_scores') THEN
                EXECUTE format('GRANT SELECT ON TABLE %I.%I TO %I', app_schema, app_table, client_role);
            END IF;
        END LOOP;
    END LOOP;
END
$$;

COMMIT;
