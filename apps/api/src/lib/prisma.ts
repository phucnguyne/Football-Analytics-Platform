// Re-export the shared Prisma singleton and types from @app/database.
// @prisma/client lives in packages/database — importing directly from
// @prisma/client here would fail because it is not in this package's deps.
export { prisma } from "@app/database";
export type { PrismaClient } from "@app/database";
