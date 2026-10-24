import { z } from 'zod';
import { emptyStringToUndefined, env as sharedEnv } from '@app/config'

const serviceSecretSchema = z
  .string({ required_error: 'INTERNAL_SERVICE_SECRET is required' })
  .min(32, 'INTERNAL_SERVICE_SECRET must be at least 32 characters')

/**
 * Type-safe env for apps/api (Fastify).
 * Validated at process startup — missing vars throw immediately with a clear message.
 */
const apiEnvSchema = z.object({
  PORT:   z.coerce.number().int().positive().default(3002),
  HOST:   z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // URL of the Next.js web app (used for CORS allow-list)
  WEB_APP_URL: z.string().url().default('http://localhost:3000'),

  // Internal communication with apps/realtime
  REALTIME_INTERNAL_URL: z.string().url().default('http://localhost:3001'),
  INTERNAL_SERVICE_SECRET: serviceSecretSchema,
});

function parseEnv() {
  const result = apiEnvSchema.safeParse({
    PORT:                    emptyStringToUndefined(process.env.PORT),
    HOST:                    emptyStringToUndefined(process.env.HOST),
    NODE_ENV:                emptyStringToUndefined(process.env.NODE_ENV),
    WEB_APP_URL:             emptyStringToUndefined(process.env.WEB_APP_URL),
    REALTIME_INTERNAL_URL:   emptyStringToUndefined(process.env.REALTIME_INTERNAL_URL),
    INTERNAL_SERVICE_SECRET: emptyStringToUndefined(process.env.INTERNAL_SERVICE_SECRET),
  });

  if (!result.success) {
    const messages = result.error.issues
      .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(
      `\n\n🔴 Invalid environment variables in apps/api:\n${messages}\n\n` +
      `Check apps/api/.env\n`
    );
  }

  return { ...result.data, DATABASE_URL: sharedEnv.DATABASE_URL };
}

export const env = parseEnv();
export type ApiEnv = typeof env;
