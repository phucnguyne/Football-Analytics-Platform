import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = process.argv[2]
if (!directory) throw new Error('Pass a directory containing openfootball season folders, each with en.1.json')

const teams = []
const teamsByName = new Map()
const matches = []
const seasons = []
function teamIndex(name) {
  if (!teamsByName.has(name)) {
    teamsByName.set(name, teams.length)
    teams.push(name)
  }
  return teamsByName.get(name)
}

for (let year = 2018; year <= 2025; year++) {
  const season = `${year}-${String(year + 1).slice(-2)}`
  const data = readFileSync(resolve(directory, season, 'en.1.json'))
  const { matches: fixtures } = JSON.parse(data)
  const seen = new Set()
  for (const fixture of fixtures) {
    const { date, team1, team2, score } = fixture
    const day = Date.parse(date) / 86_400_000
    const result = Array.isArray(score) ? score : score?.ft
    const key = `${team1}:${team2}`
    if (!Number.isInteger(day) || !team1 || !team2 || seen.has(key) || result?.length !== 2 ||
        !result.every((goal) => Number.isInteger(goal) && goal >= 0)) {
      throw new Error(`Invalid fixture in ${season}: ${key}`)
    }
    seen.add(key)
    matches.push([day, teamIndex(team1), teamIndex(team2), ...result])
  }
  if (fixtures.length !== 380) throw new Error(`Expected 380 completed fixtures in ${season}`)
  seasons.push({ season, sha256: createHash('sha256').update(data).digest('hex') })
}
matches.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2])
const metadata = { source: 'https://github.com/openfootball/football.json', license: 'CC0-1.0', seasons, teams }
const header = JSON.stringify(metadata, null, 2).trimEnd().slice(0, -1)
const output = `${header.trimEnd()},\n  "matches": [\n${matches.map((match) => '    '+ JSON.stringify(match)).join(',\n')}\n  ]\n}\n`
writeFileSync(fileURLToPath(new URL('../apps/web/src/models/openfootball-epl-results.json', import.meta.url)), output)
