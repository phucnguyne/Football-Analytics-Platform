// ─── config/env.ts ───────────────────────────────────────────────────────────
// Đọc và validate tất cả biến môi trường. Throw sớm nếu thiếu biến bắt buộc.

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const env = {
  port: parseInt(optional("REALTIME_PORT", "3001"), 10),

  // URL của Next.js app để cấu hình CORS
  webUrl: optional("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),

  // JWT secret — dùng chung với NextAuth
  jwtSecret: required("NEXTAUTH_SECRET"),

  // Redis (tuỳ chọn — nếu không có thì dùng in-memory adapter)
  redisUrl: optional("REDIS_URL", ""),

  // Database (Prisma)
  databaseUrl: required("DATABASE_URL"),

  nodeEnv: optional("NODE_ENV", "development"),
  isDev: optional("NODE_ENV", "development") === "development",
} as const;
