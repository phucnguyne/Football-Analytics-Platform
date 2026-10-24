import 'server-only'
import { z } from 'zod';
import { emptyStringToUndefined, env as sharedEnv } from '@app/config'

/**
 * Type-safe env for apps/web (Next.js).
 *
 * Two sections:
 *  - SERVER: only available in API routes / server components (no NEXT_PUBLIC_ prefix)
 *  - CLIENT: safe to expose to the browser (NEXT_PUBLIC_ prefix)
 *
 * Validated once at module load; throws clearly if vars are missing so we
 * never get a silent `undefined` deep inside a fetch() call.
 */
const webEnvSchema = z.object({
  // ── Server-only ─────────────────────────────────────────────────────────────
  NEXTAUTH_SECRET: z
    .string({ required_error: 'NEXTAUTH_SECRET is required' })
    .min(32, 'NEXTAUTH_SECRET must be at least 32 characters'),

  NEXTAUTH_URL: z.string().url().default('http://localhost:3000'),

  /** Server-side API key — never sent to the browser */
  FOOTBALL_DATA_API_KEY: z
    .string({ required_error: 'FOOTBALL_DATA_API_KEY is required' })
    .min(1),
  FOOTBALL_DATA_API_URL: z
    .string()
    .url()
    .default('https://api.football-data.org/v4'),

  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // ── Public (browser-safe) ───────────────────────────────────────────────────
  /** Socket.io server URL, injected into client bundles */
  NEXT_PUBLIC_WEBSOCKET_URL: z
    .string()
    .url()
    .default('http://localhost:3001'),

  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_APP_NAME: z.string().default('Football Analytics'),
});

function parseEnv() {
  const result = webEnvSchema.safeParse({
    NEXTAUTH_SECRET:            emptyStringToUndefined(process.env.NEXTAUTH_SECRET),
    NEXTAUTH_URL:               emptyStringToUndefined(process.env.NEXTAUTH_URL),
    FOOTBALL_DATA_API_KEY:      emptyStringToUndefined(process.env.FOOTBALL_DATA_API_KEY),
    FOOTBALL_DATA_API_URL:      emptyStringToUndefined(process.env.FOOTBALL_DATA_API_URL),
    NODE_ENV:                   emptyStringToUndefined(process.env.NODE_ENV),
    NEXT_PUBLIC_WEBSOCKET_URL:  emptyStringToUndefined(process.env.NEXT_PUBLIC_WEBSOCKET_URL),
    NEXT_PUBLIC_APP_URL:        emptyStringToUndefined(process.env.NEXT_PUBLIC_APP_URL),
    NEXT_PUBLIC_APP_NAME:       emptyStringToUndefined(process.env.NEXT_PUBLIC_APP_NAME),
  });

  if (!result.success) {
    const messages = result.error.issues
      .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(
      `\n\n🔴 Invalid environment variables in apps/web:\n${messages}\n\n` +
      `Check apps/web/.env\n`
    );
  }

  return { ...result.data, DATABASE_URL: sharedEnv.DATABASE_URL };
}

export const env = parseEnv();
export type WebEnv = typeof env;
