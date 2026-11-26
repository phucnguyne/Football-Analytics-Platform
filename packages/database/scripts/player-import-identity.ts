export function nameKey(value: string | null | undefined) {
  return (value ?? '').replace(/\\u([0-9a-f]{4})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

const teamAliases: Record<string, string> = {
  brighton: 'brightonhovealbion', newcastle: 'newcastleunited', manchesterutd: 'manchesterunited',
  manutd: 'manchesterunited', mancity: 'manchestercity', spurs: 'tottenhamhotspur',
  tottenham: 'tottenhamhotspur', wolves: 'wolverhamptonwanderers', wolverhampton: 'wolverhamptonwanderers',
  nottmforest: 'nottinghamforest', westham: 'westhamunited', bournemouthafc: 'bournemouth',
  leeds: 'leedsunited', ipswich: 'ipswichtown', coventry: 'coventrycity',
}

export function teamKey(value: string) {
  const key = nameKey(value.replace(/\b(football club|fc|afc|and)\b/gi, ''))
  return teamAliases[key] ?? key
}

export function uniqueMatch<T>(rows: readonly T[], condition: (row: T) => boolean): T | undefined {
  const matches = rows.filter(condition)
  return matches.length === 1 ? matches[0] : undefined
}

export function rosterNameMatches(local: string, shortName?: string, fullName?: string) {
  const tokens = (name: string | undefined) => (name ?? '').trim().split(/\s+/).map(nameKey).filter(Boolean)
  const localWords = tokens(local)
  const fullWords = tokens(fullName)
  if (localWords.length < 2) return false

  // Middle names can differ between the league roster and the provider's registered name.
  if (fullWords.length > 2 && localWords[0] === fullWords[0] && localWords.at(-1) === fullWords.at(-1)) return true

  const shortWords = tokens(shortName)
  return shortWords.length >= 2 && shortWords[0].length === 1 &&
    shortWords[0] === localWords[0][0] && shortWords.slice(1).join('') === localWords.slice(1).join('')
}

export function providerNumber(value: unknown, { integer = false, max = Infinity } = {}) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 && number <= max && (!integer || Number.isInteger(number)) ? number : null
}

export function splitCsvRow(line: string) {
  const parts: string[] = []
  let quoted = false
  let field = ''
  for (let index = 0; index < line.length; index++) {
    const character = line[index]
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        index++
        field += '"'
      } else quoted = !quoted
    } else if (character === ',' && !quoted) {
      parts.push(field)
      field = ''
    } else field += character
  }
  if (quoted) throw new Error('Unclosed quoted CSV field')
  return [...parts, field]
}
