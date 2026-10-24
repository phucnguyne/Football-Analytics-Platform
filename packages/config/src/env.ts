import { z } from 'zod';

const databaseUrlSchema = z
  .string({ required_error: 'DATABASE_URL is required' })
  .url('DATABASE_URL must be a valid PostgreSQL URL')
  .refine(
    (value) => ['postgres:', 'postgresql:'].includes(new URL(value).protocol),
    'DATABASE_URL must use the postgres:// or postgresql:// protocol'
  );

const sharedSchema = z.object({
  DATABASE_URL: databaseUrlSchema,
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const footballDataSchema = z.object({
  FOOTBALL_DATA_API_KEY: z
    .string({ required_error: 'FOOTBALL_DATA_API_KEY is required' })
    .min(1, 'FOOTBALL_DATA_API_KEY cannot be empty'),
  FOOTBALL_DATA_API_URL: z
    .string()
    .url()
    .default('https://api.football-data.org/v4'),
});

export function emptyStringToUndefined(value: string | undefined) {
  return value?.trim() || undefined;
}

function formatValidationError(scope: string, issues: z.ZodIssue[]) {
  const messages = issues
    .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');

  return new Error(
    `\n\n🔴 Invalid environment variables in ${scope}:\n${messages}\n\n` +
      'Check your .env file.\n'
  );
}

function parseSharedEnv() {
  const result = sharedSchema.safeParse({
    DATABASE_URL: emptyStringToUndefined(process.env.DATABASE_URL),
    NODE_ENV: emptyStringToUndefined(process.env.NODE_ENV),
  });

  if (!result.success) {
    throw formatValidationError('@app/config', result.error.issues);
  }

  return result.data;
}

export function getFootballDataEnv() {
  const result = footballDataSchema.safeParse({
    FOOTBALL_DATA_API_KEY: emptyStringToUndefined(process.env.FOOTBALL_DATA_API_KEY),
    FOOTBALL_DATA_API_URL: emptyStringToUndefined(process.env.FOOTBALL_DATA_API_URL),
  });

  if (!result.success) {
    throw formatValidationError('football-data.org', result.error.issues);
  }

  return result.data;
}

export const env = parseSharedEnv();
export type Env = typeof env;
