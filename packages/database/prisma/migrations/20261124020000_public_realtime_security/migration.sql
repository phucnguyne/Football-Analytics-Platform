BEGIN;

-- The browser only needs to know when to refetch the public scoreboard.
CREATE TABLE public.live_match_updates (
    match_id INTEGER PRIMARY KEY REFERENCES public.matches(id) ON UPDATE CASCADE ON DELETE CASCADE,
    updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.live_match_updates ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.signal_live_match_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
    fixture_id integer;
BEGIN
    IF TG_TABLE_NAME = 'matches' THEN
        IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status
            AND OLD.minute IS NOT DISTINCT FROM NEW.minute THEN RETURN NULL; END IF;
        fixture_id := NEW.id;
    ELSE
        IF TG_OP = 'UPDATE' AND OLD."homeTeamGoals" IS NOT DISTINCT FROM NEW."homeTeamGoals"
            AND OLD."awayTeamGoals" IS NOT DISTINCT FROM NEW."awayTeamGoals" THEN RETURN NULL; END IF;
        fixture_id := NEW."matchId";
    END IF;

    INSERT INTO public.live_match_updates (match_id) VALUES (fixture_id)
    ON CONFLICT (match_id) DO UPDATE SET updated_at = clock_timestamp();
    RETURN NULL;
END;
$$;

CREATE TRIGGER match_update_signal AFTER INSERT OR UPDATE OF status, minute ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.signal_live_match_update();
CREATE TRIGGER score_update_signal AFTER INSERT OR UPDATE OF "homeTeamGoals", "awayTeamGoals" ON public.match_scores
FOR EACH ROW EXECUTE FUNCTION public.signal_live_match_update();

REVOKE ALL ON FUNCTION public.signal_live_match_update() FROM PUBLIC;
REVOKE ALL ON TABLE public.live_match_updates, public.matches, public.match_scores,
    public.push_subscriptions, public.push_deliveries, public.sessions FROM PUBLIC;

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read matches" ON public.matches;
DROP POLICY IF EXISTS "Public can read match scores" ON public.match_scores;

DO $$
DECLARE
    client_role text;
    source_table text;
BEGIN
    FOR client_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated') LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION public.signal_live_match_update() FROM %I', client_role);
        EXECUTE format('REVOKE ALL ON TABLE public.live_match_updates, public.matches, public.match_scores,
             public.push_subscriptions, public.push_deliveries, public.sessions FROM %I', client_role);
        EXECUTE format('GRANT SELECT ON public.live_match_updates TO %I', client_role);
        EXECUTE format('CREATE POLICY %I ON public.live_match_updates FOR SELECT TO %I USING (true)',
            'Read live updates: ' || client_role, client_role);
    END LOOP;

    IF EXISTS (SELECT FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        FOREACH source_table IN ARRAY ARRAY['matches', 'match_scores'] LOOP
            IF EXISTS (SELECT FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
                AND schemaname = 'public' AND tablename = source_table) THEN
                EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', source_table);
            END IF;
        END LOOP;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.live_match_updates;
    END IF;
END
$$;

COMMIT;
