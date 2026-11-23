-- Compatibility migration for databases provisioned before live_match_updates.
DO $$
BEGIN
  IF to_regclass('public.live_match_updates') IS NOT NULL THEN
    RETURN;
  END IF;
-- Public match/score data is readable by anonymous website visitors.
-- Writes stay server-side through Prisma or the Edge Function service role.
alter table public.matches enable row level security;
alter table public.match_scores enable row level security;

drop policy if exists "Public can read matches" on public.matches;
create policy "Public can read matches"
  on public.matches for select to anon, authenticated using (true);

drop policy if exists "Public can read match scores" on public.match_scores;
create policy "Public can read match scores"
  on public.match_scores for select to anon, authenticated using (true);

grant select on public.matches, public.match_scores to anon, authenticated;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'match_scores'
  ) then
    alter publication supabase_realtime add table public.match_scores;
  end if;
end
$$;
