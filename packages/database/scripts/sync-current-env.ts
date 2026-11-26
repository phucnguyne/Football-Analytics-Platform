import dotenv from 'dotenv'

const audit = process.argv[2] === '--audit'
const apiFootball = process.argv[2] === '--api-football'
const environment = process.argv[audit || apiFootball ? 3 : 2]
const envFiles: Record<string, string> = {
  development: '.env.development',
  production: '.env.production',
}
const envFile = environment ? envFiles[environment] : undefined

if (!envFile) {
  throw new Error('Choose an environment: development or production.')
}

const result = dotenv.config({ path: envFile, override: true, quiet: true })
if (result.error || !result.parsed?.DATABASE_URL) {
  throw new Error(`Could not load ${envFile}. Copy and configure its matching example file first.`)
}
if (!audit && !apiFootball && !result.parsed.FOOTBALL_DATA_API_KEY?.trim()) {
  throw new Error(`FOOTBALL_DATA_API_KEY is required in ${envFile} for fixture imports.`)
}

const operation = audit ? import('./audit-analytics')
  : apiFootball ? import('./import-api-football') : import('./sync-current')
void operation.catch((error) => {
  console.error(error)
  process.exitCode = 1
})
