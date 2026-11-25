CREATE FUNCTION public.apply_live_match_updates(updates jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE
    incoming record;
    fixture record;
    previous_score record;
    status_changed boolean;
    match_changed boolean;
    score_changed boolean;
    processed integer := 0;
    changed integer := 0;
BEGIN
    FOR incoming IN
        SELECT *
        FROM jsonb_to_recordset(updates) AS source(
            match_id integer, status public."MatchStatus", minute integer, score_id text,
            home_goals integer, away_goals integer, home_half integer, away_half integer,
            winner public."Winner", duration public."Duration"
        )
        ORDER BY match_id
    LOOP
        SELECT m.status, m.minute INTO fixture
        FROM public.matches AS m WHERE m.id = incoming.match_id FOR UPDATE;
        IF NOT FOUND THEN CONTINUE; END IF;
        processed := processed + 1;

        IF fixture.status = 'FINISHED' AND incoming.status IN ('SCHEDULED', 'TIMED', 'IN_PLAY', 'PAUSED') THEN
            CONTINUE;
        END IF;
        IF incoming.status = 'FINISHED' AND (incoming.home_goals IS NULL OR incoming.away_goals IS NULL) THEN
            CONTINUE;
        END IF;

        SELECT s."homeTeamGoals", s."awayTeamGoals", s."homeTeamGoalsHT", s."awayTeamGoalsHT", s.winner, s.duration
        INTO previous_score FROM public.match_scores AS s WHERE s."matchId" = incoming.match_id;
        status_changed := fixture.status IS DISTINCT FROM incoming.status;
        match_changed := status_changed OR fixture.minute IS DISTINCT FROM incoming.minute;
        score_changed := incoming.home_goals IS NOT NULL AND incoming.away_goals IS NOT NULL AND (
            NOT FOUND OR ROW(previous_score."homeTeamGoals", previous_score."awayTeamGoals",
                previous_score."homeTeamGoalsHT", previous_score."awayTeamGoalsHT", previous_score.winner, previous_score.duration)
                IS DISTINCT FROM ROW(incoming.home_goals, incoming.away_goals, incoming.home_half,
                    incoming.away_half, incoming.winner, incoming.duration)
        );

        IF match_changed OR score_changed THEN
            UPDATE public.matches
            SET status = incoming.status, minute = incoming.minute, "lastUpdated" = clock_timestamp() AT TIME ZONE 'UTC'
            WHERE id = incoming.match_id;
            changed := changed + 1;
        END IF;

        -- Update the score on a status transition too, so the push trigger observes full time
        -- even when the score is unchanged from the last minute of play.
        IF score_changed OR (status_changed AND incoming.home_goals IS NOT NULL AND incoming.away_goals IS NOT NULL) THEN
            INSERT INTO public.match_scores (id, "matchId", "homeTeamGoals", "awayTeamGoals",
                "homeTeamGoalsHT", "awayTeamGoalsHT", winner, duration)
            VALUES (incoming.score_id, incoming.match_id, incoming.home_goals, incoming.away_goals,
                incoming.home_half, incoming.away_half, incoming.winner, incoming.duration)
            ON CONFLICT ("matchId") DO UPDATE SET
                "homeTeamGoals" = EXCLUDED."homeTeamGoals", "awayTeamGoals" = EXCLUDED."awayTeamGoals",
                "homeTeamGoalsHT" = EXCLUDED."homeTeamGoalsHT", "awayTeamGoalsHT" = EXCLUDED."awayTeamGoalsHT",
                winner = EXCLUDED.winner, duration = EXCLUDED.duration;
        END IF;
    END LOOP;
    RETURN jsonb_build_object('processed', processed, 'changed', changed);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_live_match_updates(jsonb) FROM PUBLIC;
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN
        GRANT EXECUTE ON FUNCTION public.apply_live_match_updates(jsonb) TO service_role;
    END IF;
    IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON FUNCTION public.apply_live_match_updates(jsonb) FROM anon;
    END IF;
    IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON FUNCTION public.apply_live_match_updates(jsonb) FROM authenticated;
    END IF;
END;
$$;
