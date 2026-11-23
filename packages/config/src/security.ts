import { timingSafeEqual } from 'node:crypto'
import { z } from 'zod'

export const httpOrigin = z.string().url().refine((value) => {
  const url = URL.canParse(value) ? new URL(value) : null
  return url !== null && ['https:', 'http:'].includes(url.protocol) && url.pathname === '/' &&
    !url.username && !url.password && !url.search && !url.hash
}, 'Use an HTTP(S) origin without a path, credentials or query').transform((value) => new URL(value).origin)

export function matchesSecret(expected: string | undefined, supplied: unknown) {
  if (!expected || typeof supplied !== 'string') return false
  const actual = Buffer.from(supplied)
  const wanted = Buffer.from(expected)
  return actual.length === wanted.length && timingSafeEqual(actual, wanted)
}
