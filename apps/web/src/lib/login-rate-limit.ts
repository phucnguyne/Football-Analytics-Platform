import "server-only";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import prisma from "@app/database/src/client";
import { env } from "@/lib/env";

const MAX_ATTEMPTS_PER_EMAIL = 5;
const MAX_ATTEMPTS_PER_IP = 30;

function bucketKey(scope: "email" | "ip", value: string) {
  return createHmac("sha256", env.NEXTAUTH_SECRET)
    .update(`login:${scope}:${value}`)
    .digest("hex");
}

async function reserveAttempt(key: string, limit: number) {
  // The UPSERT checks and consumes a slot atomically across app instances.
  const [attempt] = await prisma.$queryRaw<{ expiresAt: Date }[]>`
    INSERT INTO "login_attempts" AS bucket ("key", "attempts", "expiresAt")
    VALUES (${key}, 1, CURRENT_TIMESTAMP + INTERVAL '15 minutes')
    ON CONFLICT ("key") DO UPDATE SET
      "attempts" = CASE WHEN bucket."expiresAt" <= CURRENT_TIMESTAMP
                        THEN 1 ELSE bucket."attempts" + 1 END,
      "expiresAt" = CASE WHEN bucket."expiresAt" <= CURRENT_TIMESTAMP
                         THEN EXCLUDED."expiresAt" ELSE bucket."expiresAt" END
    WHERE bucket."expiresAt" <= CURRENT_TIMESTAMP OR bucket."attempts" < ${limit}
    RETURNING "expiresAt"
  `;
  return attempt;
}

export async function reserveLoginAttempt(
  email: string,
  headers: Record<string, unknown> | undefined,
) {
  // Vercel supplies this header at its ingress. Self-hosted instances still
  // apply the email limit without trusting arbitrary client-supplied headers.
  const forwardedIp = process.env.VERCEL === "1"
    ? headers?.["x-vercel-forwarded-for"]
    : undefined;
  const ip = typeof forwardedIp === "string" ? forwardedIp.trim() : "";

  if (isIP(ip) && !(await reserveAttempt(bucketKey("ip", ip), MAX_ATTEMPTS_PER_IP))) {
    return null;
  }

  if (Math.random() < 0.01) {
    await prisma.$executeRaw`
      DELETE FROM "login_attempts" WHERE "key" IN (
        SELECT "key" FROM "login_attempts"
        WHERE "expiresAt" <= CURRENT_TIMESTAMP
        ORDER BY "expiresAt"
        LIMIT 1000 FOR UPDATE SKIP LOCKED
      )
    `;
  }

  const key = bucketKey("email", email.toLowerCase());
  const attempt = await reserveAttempt(key, MAX_ATTEMPTS_PER_EMAIL);
  return attempt ? { key, expiresAt: attempt.expiresAt } : null;
}

export async function resetLoginAttempts(attempt: { key: string; expiresAt: Date }) {
  await prisma.$executeRaw`
    DELETE FROM "login_attempts"
    WHERE "key" = ${attempt.key} AND "expiresAt" = ${attempt.expiresAt}
  `;
}
