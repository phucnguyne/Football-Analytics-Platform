interface TeamRecord {
  id: number
  name: string
  shortName: string
  crest: string | null
}

interface HistoricalTeam {
  id: number
  name: string
  shortName: string
  crest: string | null
}

export interface HistoricalMatch {
  id: number
  utcDate: string
  status: 'FINISHED' | 'POSTPONED'
  matchday: null
  homeTeam: HistoricalTeam
  awayTeam: HistoricalTeam
  score: {
    winner: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null
    duration: 'REGULAR'
    fullTime: { home: number | null; away: number | null }
    halfTime: { home: number | null; away: number | null }
  }
  competition: { id: number; name: string; code: string }
  season: { id: number; startDate: string; endDate: string }
  source: 'football-data.co.uk'
}

function parseCsvRow(line: string): string[] {
  const fields: string[] = []
  let field = ''
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (character === ',' && !quoted) {
      fields.push(field.trim())
      field = ''
    } else {
      field += character
    }
  }

  fields.push(field.trim())
  return fields
}

function parseNumber(value: string | undefined): number | null {
  if (!value?.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeTeamName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(football club|fc|afc|the)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function stableNegativeId(value: string): number {
  let hash = 2166136261
  for (const character of value) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return -((hash >>> 0) % 1_000_000_000 + 1)
}

function resolveTeam(name: string, knownTeams: TeamRecord[]): HistoricalTeam {
  const normalizedName = normalizeTeamName(name)
  const known = knownTeams.find((team) =>
    normalizeTeamName(team.name) === normalizedName ||
    normalizeTeamName(team.shortName) === normalizedName,
  )

  return known
    ? {
        id: known.id,
        name: known.name,
        shortName: known.shortName,
        crest: known.crest,
      }
    : {
        id: stableNegativeId(normalizedName),
        name,
        shortName: name,
        crest: null,
      }
}

function parseMatchDate(date: string, time: string | undefined): string | null {
  const match = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)
  if (!match) return null

  const day = Number(match[1])
  const month = Number(match[2]) - 1
  const yearPart = Number(match[3])
  const year = match[3].length === 2
    ? (yearPart >= 90 ? 1900 + yearPart : 2000 + yearPart)
    : yearPart
  const [hours = '15', minutes = '00'] = (time || '15:00').split(':')
  const parsed = new Date(Date.UTC(year, month, day, Number(hours), Number(minutes)))
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function matchId(season: number, rowIndex: number): number {
  return -(season * 1000 + rowIndex)
}

export async function getHistoricalPremierLeagueMatches(
  seasonYear: number,
  knownTeams: TeamRecord[],
): Promise<HistoricalMatch[]> {
  const seasonCode = `${String(seasonYear).slice(-2)}${String(seasonYear + 1).slice(-2)}`
  const response = await fetch(
    `https://www.football-data.co.uk/mmz4281/${seasonCode}/E0.csv`,
    {
      headers: { 'User-Agent': 'FootballAnalyticsPlatform/1.0' },
      next: { revalidate: 86400 },
    },
  )
  if (!response.ok) {
    throw new Error(`Historical Premier League data request failed (${response.status})`)
  }

  const lines = (await response.text()).replace(/^\uFEFF/, '').split(/\r?\n/)
  if (lines.length < 2) return []

  const headers = parseCsvRow(lines[0])
  const columns = new Map(headers.map((header, index) => [header, index]))
  const value = (row: string[], name: string) => {
    const index = columns.get(name)
    return index === undefined ? undefined : row[index]
  }

  return lines.slice(1).flatMap((line, rowIndex) => {
    if (!line.trim()) return []
    const row = parseCsvRow(line)
    const dateText = value(row, 'Date')
    const homeName = value(row, 'HomeTeam')
    const awayName = value(row, 'AwayTeam')
    if (!dateText || !homeName || !awayName) return []

    const utcDate = parseMatchDate(dateText, value(row, 'Time'))
    if (!utcDate) return []

    const homeGoals = parseNumber(value(row, 'FTHG'))
    const awayGoals = parseNumber(value(row, 'FTAG'))
    const finished = homeGoals !== null && awayGoals !== null
    const result = value(row, 'FTR')
    const match: HistoricalMatch = {
      id: matchId(seasonYear, rowIndex),
      utcDate,
      status: finished ? 'FINISHED' : 'POSTPONED',
      matchday: null,
      homeTeam: resolveTeam(homeName, knownTeams),
      awayTeam: resolveTeam(awayName, knownTeams),
      score: {
        winner: result === 'H' ? 'HOME_TEAM' : result === 'A' ? 'AWAY_TEAM' : result === 'D' ? 'DRAW' : null,
        duration: 'REGULAR',
        fullTime: { home: homeGoals, away: awayGoals },
        halfTime: {
          home: parseNumber(value(row, 'HTHG')),
          away: parseNumber(value(row, 'HTAG')),
        },
      },
      competition: { id: 2021, name: 'Premier League', code: 'PL' },
      season: {
        id: seasonYear,
        startDate: `${seasonYear}-08-01`,
        endDate: `${seasonYear + 1}-07-31`,
      },
      source: 'football-data.co.uk',
    }
    return [match]
  })
}

export async function getHistoricalPremierLeagueMatchById(
  matchId: number,
  knownTeams: TeamRecord[],
): Promise<HistoricalMatch | null> {
  if (matchId >= 0) return null
  const seasonYear = Math.floor(Math.abs(matchId) / 1000)
  if (seasonYear < 1993 || seasonYear > new Date().getFullYear()) return null

  const matches = await getHistoricalPremierLeagueMatches(seasonYear, knownTeams)
  return matches.find((match) => match.id === matchId) ?? null
}
