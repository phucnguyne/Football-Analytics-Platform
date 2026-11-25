import { PrismaClient } from '@prisma/client'

const database = new PrismaClient()

async function audit() {
  const report = await database.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`
    const [schema, players, stats, events, matchStats, history] = await Promise.all([
      tx.$queryRaw`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'
        AND (table_name, column_name) IN (('player_stats', 'dataSource'), ('match_events', 'analyticsSource'))
        ORDER BY 1, 2`,
      tx.$queryRaw`SELECT COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE name ~* '(Goalkeeper|Defender|Midfielder|Forward) [0-9]+$')::int AS "placeholderNames" FROM public.players`,
      tx.$queryRaw`SELECT COALESCE(to_jsonb(stats)->>'dataSource', 'UNKNOWN') AS source, COUNT(*)::int AS count
        FROM public.player_stats AS stats GROUP BY 1 ORDER BY 1`,
      tx.$queryRaw`SELECT type::text, COALESCE(to_jsonb(event)->>'analyticsSource', 'UNKNOWN') AS source, COUNT(*)::int AS count
        FROM public.match_events AS event
        WHERE type::text = 'SHOT' OR (type::text IN ('GOAL', 'PENALTY_GOAL', 'OWN_GOAL') AND
          (to_jsonb(event)->>'x' IS NOT NULL OR to_jsonb(event)->>'y' IS NOT NULL OR to_jsonb(event)->>'xG' IS NOT NULL))
        GROUP BY 1, 2 ORDER BY 1, 2`,
      tx.$queryRaw`SELECT COUNT(*)::int AS total FROM public.match_statistics`,
      tx.$queryRaw<{ exists: boolean }[]>`SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS exists`,
    ])
    const migrations = history[0]?.exists
      ? await tx.$queryRaw`SELECT migration_name AS name FROM public._prisma_migrations
          WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`
      : null
    return { migrations, provenanceColumns: schema, players, stats, events, matchStats }
  }, { timeout: 15000 })
  console.log(JSON.stringify(report, null, 2))
}

audit().catch((error: { code?: string; errorCode?: string; meta?: { code?: string } }) => {
  const state = error.meta?.code
  const details = state && /^[A-Z0-9]{5}$/.test(state) ? `, SQLSTATE ${state}` : ''
  console.error(`Analytics audit failed (${error.code ?? error.errorCode ?? 'unknown error'}${details})`)
  process.exitCode = 1
}).finally(() => database.$disconnect())
