import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  SOCKET_URL: z.string().url().default('http://localhost:3001'),
  API_URL: z.string().url().default('http://localhost:3002'),
  NEXTAUTH_SECRET: z.string().optional(),
  NEXTAUTH_URL: z.string().url().optional(),
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL || process.env.SOCKET_URL,
  API_URL: process.env.NEXT_PUBLIC_API_URL || process.env.API_URL,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
});
