import { z } from 'zod'
import { locales } from '@/i18n/locales'

const allowedHosts = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com']
const allowedSuffixes = ['.push.apple.com', '.notify.windows.com']

function isPushEndpoint(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash
      && (allowedHosts.includes(url.hostname) || allowedSuffixes.some((suffix) => url.hostname.endsWith(suffix)))
  } catch {
    return false
  }
}

export const endpointSchema = z.string().max(2048).refine(isPushEndpoint)
export const subscriptionSchema = z.object({
  endpoint: endpointSchema,
  keys: z.object({
    p256dh: z.string().regex(/^[\w-]{87}$/),
    auth: z.string().regex(/^[\w-]{22}$/),
  }),
  locale: z.enum(locales),
})
