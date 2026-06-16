/**
 * src/server.ts  —  Custom Next.js HTTP server
 *
 * Bootstraps the Socket.io server alongside Next.js so that:
 *  • Socket.io attaches to the *same* port as the Next.js dev/prod server.
 *  • The route handler at /api/socket/route.ts can find the HTTP server via
 *    `globalThis.__nextHttpServer`.
 *
 * Start with:
 *   pnpm dev    →  package.json "dev": "tsx watch src/server.ts"
 *   pnpm build && pnpm start  →  "start": "NODE_ENV=production tsx src/server.ts"
 *
 * package.json scripts (add / replace):
 * ─────────────────────────────────────
 *   "dev":   "tsx watch src/server.ts",
 *   "start": "NODE_ENV=production tsx src/server.ts"
 */

import { createServer, IncomingMessage, ServerResponse } from 'http'
import { parse } from 'url'
import next from 'next'

declare const globalThis: {
  __nextHttpServer?: ReturnType<typeof createServer>
} & typeof global

const PORT = parseInt(process.env.PORT ?? '3000', 10)
const dev  = process.env.NODE_ENV !== 'production'

async function main() {
  const app    = next({ dev })
  const handle = app.getRequestHandler()

  await app.prepare()

  const httpServer = createServer(
    (req: IncomingMessage, res: ServerResponse) => {
      const parsedUrl = parse(req.url ?? '/', true)
      handle(req, res, parsedUrl)
    }
  )

  // Expose the HTTP server so /api/socket/route.ts can attach Socket.io
  globalThis.__nextHttpServer = httpServer

  httpServer.listen(PORT, () => {
    console.log(`▲ Next.js ready on http://localhost:${PORT}`)
    console.log(`  Socket.io will attach at /api/socket`)
  })
}

main().catch((err) => {
  console.error('Server failed to start:', err)
  process.exit(1)
})