import type { Instrumentation } from 'next'
import { logServerError } from '@/lib/server-logger'

export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const digest = typeof error === 'object' && error !== null &&
    'digest' in error && typeof error.digest === 'string' ? error.digest : undefined

  logServerError('request_error', {
    method: request.method,
    route: context.routePath,
    routeType: context.routeType,
    digest,
  })
}
