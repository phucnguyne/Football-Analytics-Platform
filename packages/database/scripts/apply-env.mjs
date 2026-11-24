import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, renameSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { parse } from 'dotenv'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const database = fileURLToPath(new URL('../', import.meta.url))
const migrations = new URL('../prisma/migrations/', import.meta.url)
const resolve = createRequire(import.meta.url).resolve

function run(command, args, { cwd = root, env = process.env, capture = false, allowedStatus = [0] } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    stdio: ['inherit', capture ? 'pipe' : 'inherit', 'inherit'],
  })
  if (result.error) throw result.error
  if (!allowedStatus.includes(result.status)) {
    throw new Error(`${command} ${args.join(' ')} failed (${result.signal ?? result.status}).`)
  }
  return capture ? result.stdout.trim() : result.status
}

function databaseEnv(environment) {
  const file = `.env.${environment}`
  let databaseUrl
  try {
    databaseUrl = parse(readFileSync(new URL(`../${file}`, import.meta.url))).DATABASE_URL
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    throw new Error(`Copy packages/database/${file}.example to packages/database/${file} and set DATABASE_URL.`)
  }

  let url
  try {
    url = new URL(databaseUrl)
  } catch {
    throw new Error(`Set a valid PostgreSQL DATABASE_URL in packages/database/${file}.`)
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname.length <= 1) {
    throw new Error(`Set a valid PostgreSQL DATABASE_URL in packages/database/${file}.`)
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (environment === 'development' && !local) {
    throw new Error('Use a local PostgreSQL URL in packages/database/.env.development.')
  }
  if (environment === 'production' && local) {
    throw new Error('Use the production PostgreSQL URL in packages/database/.env.production.')
  }
  return { ...process.env, DATABASE_URL: databaseUrl }
}

function prisma(env, args, allowedStatus) {
  return run(process.execPath, [resolve('prisma'), ...args], { cwd: database, env, allowedStatus })
}

function migrationDirectories() {
  return readdirSync(migrations, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

function createMigration(env, name) {
  const existing = migrationDirectories()
  prisma(env, ['migrate', 'dev', '--create-only', '--name', name, '--skip-generate', '--skip-seed'])

  const [created, ...other] = migrationDirectories().filter((migration) => !existing.includes(migration))
  if (!created || other.length) throw new Error('Expected Prisma to create one migration.')
  const previous = existing.at(-1)
  if (previous && created < previous) {
    // Prisma uses UTC on this machine. Keep new migrations after those from clocks ahead of ours.
    const previousTime = previous.slice(0, 14).replace(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/, '$1-$2-$3T$4:$5:$6Z')
    const time = new Date(Date.parse(previousTime) + 1000).toISOString().replace(/\D/g, '').slice(0, 14)
    renameSync(new URL(created, migrations), new URL(time + created.slice(14), migrations))
  }
}

function applyDevelopment(option) {
  const start = option === '--start'
  const name = start ? 'schema_update' : option ?? 'schema_update'
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(name)) {
    throw new Error('Use a migration name containing only letters, numbers, underscores, or hyphens.')
  }

  const env = databaseEnv('development')
  prisma(env, ['migrate', 'deploy'])
  const schema = 'prisma/schema.prisma'
  const changes = prisma(env, [
    'migrate', 'diff', '--from-schema-datasource', schema, '--to-schema-datamodel', schema, '--exit-code',
  ], [0, 2])
  if (changes === 2) {
    createMigration(env, name)
    prisma(env, ['migrate', 'deploy'])
  }
  prisma(env, ['generate'])
  if (start) run('pnpm', ['-r', 'dev'], { env })
}

function applyProduction() {
  const git = (...args) => run('git', args, { capture: true })
  if (git('branch', '--show-current') !== 'main') {
    throw new Error('Switch to main before releasing to production.')
  }
  if (git('status', '--porcelain')) {
    throw new Error('Commit the code and any Prisma migrations before releasing to production.')
  }

  const env = databaseEnv('production')
  const commit = git('rev-parse', 'HEAD')
  const ref = `${commit}:refs/heads/main`
  run('git', ['push', '--dry-run', 'origin', ref])
  prisma(env, ['migrate', 'deploy'])
  console.log('Production migrations applied. Pushing the release commit to trigger Vercel.')
  run('git', ['push', 'origin', ref])
}

try {
  const [environment, option, ...extra] = process.argv.slice(2)
  if (!extra.length && environment === 'development') applyDevelopment(option)
  else if (!option && environment === 'production') applyProduction()
  else throw new Error('Use pnpm apply:dev [migration_name] or pnpm apply:prod.')
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
