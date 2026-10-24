import { z } from 'zod'

const publicEnvSchema = z.object({
  NEXT_PUBLIC_WEBSOCKET_URL: z.string().url().default('http://localhost:3001'),
})

const websocketUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL?.trim() || undefined
const result = publicEnvSchema.safeParse({
  NEXT_PUBLIC_WEBSOCKET_URL: websocketUrl,
})

if (!result.success) {
  const messages = result.error.issues
    .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
    .join('\n')

  throw new Error(`\n\n🔴 Invalid public environment variables in apps/web:\n${messages}\n`)
}

export const publicEnv = result.data
export type PublicEnv = typeof publicEnv
