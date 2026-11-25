import { NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { logServerError } from '@/lib/server-logger'

export const dynamic = 'force-dynamic'

const databaseTimeoutMs = 2_000
type ProbeResult = 'ok' | 'query_failed' | 'timeout'
let pendingProbe: Promise<ProbeResult> | undefined

function probeDatabase() {
  // A timed-out query may still be pending in the connection pool. Reuse it
  // for concurrent probes until it finishes instead of queueing more queries.
  pendingProbe ??= Promise.resolve()
    .then(() => prisma.$queryRaw`SELECT 1`)
    .then<ProbeResult, ProbeResult>(() => 'ok', () => 'query_failed')
    .finally(() => { pendingProbe = undefined })
  return pendingProbe
}

export async function GET() {
  const startedAt = Date.now()
  let timer: ReturnType<typeof setTimeout> | undefined
  let result: ProbeResult
  try {
    const deadline = new Promise<ProbeResult>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), databaseTimeoutMs)
    })
    result = await Promise.race([probeDatabase(), deadline])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }

  const ready = result === 'ok'
  if (!ready) {
    logServerError('database_readiness_failed', { reason: result, durationMs: Date.now() - startedAt })
  }

  return NextResponse.json(
    {
      status: ready ? 'ok' : 'unavailable',
      service: 'web',
      checks: { database: ready ? 'ok' : 'unavailable' },
    },
    { status: ready ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
