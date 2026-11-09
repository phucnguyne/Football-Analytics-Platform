import { z } from "zod";
import { emptyStringToUndefined, env as sharedEnv } from "@app/config";

/**
 * Type-safe env for apps/realtime (Express + Socket.io).
 * Replaces the manual required()/optional() helpers with Zod validation
 * for consistent error messages and TypeScript inference.
 */
const realtimeEnvSchema = z
  .object({
    REALTIME_PORT: z.coerce.number().int().positive().default(3001),

    // URL of the Next.js app — used for CORS allow-list
    NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

    // JWT secret — must match NextAuth's NEXTAUTH_SECRET
    NEXTAUTH_SECRET: z
      .string({ required_error: "NEXTAUTH_SECRET is required" })
      .min(32, "NEXTAUTH_SECRET must be at least 32 characters"),

    // Redis is required for shared state and Socket.io broadcasts in production.
    REDIS_URL: z
      .string()
      .url()
      .refine(
        (value) =>
          value.startsWith("redis://") || value.startsWith("rediss://"),
        {
          message: "REDIS_URL must use redis:// or rediss://",
        },
      )
      .optional(),

    // HTTP secret shared between apps/api and apps/realtime for /internal/* routes
    INTERNAL_SERVICE_SECRET: z
      .string({ required_error: "INTERNAL_SERVICE_SECRET is required" })
      .min(32, "INTERNAL_SERVICE_SECRET must be at least 32 characters"),

    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production" && !data.REDIS_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["REDIS_URL"],
        message: "REDIS_URL is required in production",
      });
    }
  });

function parseEnv() {
  const result = realtimeEnvSchema.safeParse({
    REALTIME_PORT: emptyStringToUndefined(process.env.REALTIME_PORT),
    NEXT_PUBLIC_APP_URL: emptyStringToUndefined(
      process.env.NEXT_PUBLIC_APP_URL,
    ),
    NEXTAUTH_SECRET: emptyStringToUndefined(process.env.NEXTAUTH_SECRET),
    REDIS_URL: emptyStringToUndefined(process.env.REDIS_URL),
    INTERNAL_SERVICE_SECRET: emptyStringToUndefined(
      process.env.INTERNAL_SERVICE_SECRET,
    ),
    NODE_ENV: emptyStringToUndefined(process.env.NODE_ENV),
  });

  if (!result.success) {
    const messages = result.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `\n\n🔴 Invalid environment variables in apps/realtime:\n${messages}\n\n` +
        `Check apps/realtime/.env\n`,
    );
  }

  return {
    DATABASE_URL: sharedEnv.DATABASE_URL,
    port: result.data.REALTIME_PORT,
    webUrl: result.data.NEXT_PUBLIC_APP_URL,
    jwtSecret: result.data.NEXTAUTH_SECRET,
    redisUrl: result.data.REDIS_URL ?? "",
    internalServiceSecret: result.data.INTERNAL_SERVICE_SECRET,
    nodeEnv: result.data.NODE_ENV,
    isDev: result.data.NODE_ENV === "development",
  } as const;
}

export const env = parseEnv();
export type RealtimeEnv = typeof env;
