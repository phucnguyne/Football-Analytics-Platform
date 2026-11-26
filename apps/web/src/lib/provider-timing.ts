import { AsyncLocalStorage } from 'node:async_hooks'

const calls = new AsyncLocalStorage<{ attempts: number }>()

export function fetchProvider(url: string | URL, options?: RequestInit): Promise<Response> {
  const measurement = calls.getStore()
  if (measurement) measurement.attempts++
  return fetch(url, options)
}

export async function measureProviderCalls(run: () => Promise<Response>): Promise<Response> {
  const start = performance.now()
  const measurement = { attempts: 0 }
  const response = await calls.run(measurement, run)
  response.headers.append('Server-Timing', `app;dur=${(performance.now() - start).toFixed(1)}, provider;desc="${measurement.attempts}"`)
  return response
}
