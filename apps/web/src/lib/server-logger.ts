type LogField = string | number | boolean | undefined

export function logServerError(event: string, fields: Record<string, LogField>) {
  console.error(JSON.stringify({
    level: 'error',
    service: 'web',
    event,
    timestamp: new Date().toISOString(),
    ...fields,
  }))
}
