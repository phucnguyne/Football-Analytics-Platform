import { z } from 'zod'
import { isSupabasePublicKey } from './supabase-public-key'

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().regex(/^https?:\/\//),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().refine(isSupabasePublicKey, "Use a publishable or legacy anon key"),
})

const result = publicEnvSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || undefined,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || undefined,
})

if (!result.success) {
  const messages = result.error.issues
    .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
    .join('\n')

  throw new Error(`\n\n🔴 Invalid public environment variables in apps/web:\n${messages}\n`)
}

export const publicEnv = result.data
export type PublicEnv = typeof publicEnv
