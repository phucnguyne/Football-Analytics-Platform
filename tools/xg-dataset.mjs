import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

export const statsBombRevision = '4b73468fc5b0f1950f9f66fada70ad3a4f9327cb'
export const maxMatchesPerSeason = 20

async function fetchJson(path, revision) {
  const url = `https://raw.githubusercontent.com/hudl/open-data/${revision}/data/${path}`
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const reply = await fetch(url, { signal: AbortSignal.timeout(45_000) })
      if (reply.status === 404) return null
      if (!reply.ok) throw new Error(`HTTP ${reply.status}`)
      return await reply.json()
    } catch (error) {
      if (attempt === 2) throw new Error(`Could not download ${path}`, { cause: error })
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
    }
  }
}

function shotEvents(events) {
  return events.filter((event) => event.type?.name === 'Shot' && event.shot?.outcome?.name)
    .map(({ type, team, location, period, under_pressure, shot }) => ({
      type, team: { id: team?.id }, location, period, under_pressure,
      shot: {
        outcome: { name: shot.outcome.name },
        body_part: shot.body_part, type: shot.type,
        first_time: shot.first_time, one_on_one: shot.one_on_one,
      },
    }))
}

async function readDatasetFile(root, path, { download, revision }) {
  const file = resolve(root, path)
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch (error) {
    if (error.code !== 'ENOENT' || !download) throw error
  }

  const content = await fetchJson(path, revision)
  if (content === null) return null
  const data = path.startsWith('events/') ? shotEvents(content) : content
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(data))
  return data
}

function isIncluded(competition) {
  const continentalClubCompetitions = new Set([16, 35])
  return /\bWorld Cup\b/.test(competition.competition_name) ||
    (!competition.competition_international && !continentalClubCompetitions.has(competition.competition_id))
}

export function sampleSeason(fixtures, limit = maxMatchesPerSeason) {
  if (fixtures.length <= limit) return fixtures
  return Array.from({ length: limit }, (_, index) => fixtures[Math.floor((index + 0.5) * fixtures.length / limit)])
}

async function concurrentMap(input, worker) {
  const output = []
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(12, input.length) }, async () => {
    while (cursor < input.length) {
      const index = cursor++
      output[index] = await worker(input[index])
    }
  }))
  return output
}

export async function loadXgDataset(root, options) {
  if (!/^[0-9a-f]{40}$/.test(options.revision)) throw new Error('Supply the full dataset commit SHA')
  // Keep downloaded files separate by revision so an artifact cannot silently mix releases.
  const directory = options.download ? resolve(root, options.revision) : root
  const load = (path) => readDatasetFile(directory, path, options)
  const competitions = (await load('competitions.json')).filter(isIncluded)
  const seasons = await concurrentMap(competitions, async (competition) => {
    const fixtures = await load(`matches/${competition.competition_id}/${competition.season_id}.json`)
    if (!Array.isArray(fixtures) || !fixtures.length) {
      throw new Error(`Missing fixture metadata for ${competition.competition_name} ${competition.season_name}`)
    }

    const ordered = fixtures.sort((a, b) => a.match_date.localeCompare(b.match_date) || a.match_id - b.match_id)
    return { competition, fixtures: ordered, sample: sampleSeason(ordered) }
  })

  const sampled = [...new Set(seasons.flatMap((season) => season.sample.map(({ match_id }) => match_id)))]
  let completed = 0
  const eventRows = await concurrentMap(sampled, async (id) => {
    const events = await load(`events/${id}.json`)
    if (!events) throw new Error(`No event file for sampled match ${id}`)
    if (options.download && ++completed % 100 === 0) console.log(`Loaded shot data for ${completed}/${sampled.length} matches`)
    return [id, shotEvents(events)]
  })
  return { seasons, events: new Map(eventRows), sampled: sampled.length }
}
