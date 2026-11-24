const maxHistory = 5
const dayMs = 24 * 60 * 60 * 1000
const maxAgeMs = 60 * dayMs

function summarize(history, date) {
  const recent = history.filter((match) => date - match.date <= maxAgeMs)
  let points = 0
  let scored = 0
  let allowed = 0
  let totalWeight = 0
  for (const [index, result] of recent.entries()) {
    const weight = 0.8 ** index
    points += weight * (result.scored > result.allowed ? 3 : result.scored === result.allowed ? 1 : 0)
    scored += weight * result.scored
    allowed += weight * result.allowed
    totalWeight += weight
  }
  if (!totalWeight) return { count: 0, features: [0, 0, 0] }

  const support = recent.length / (recent.length + 2)
  return {
    count: recent.length,
    features: [
      (points / (3 * totalWeight) - 0.45) * support,
      (scored / (3 * totalWeight) - 0.4) * support,
      (allowed / (3 * totalWeight) - 0.4) * support,
    ].map((value) => Number(value.toFixed(5))),
  }
}

function buildFormContexts(fixtures) {
  const result = new Map()
  const history = new Map()
  const days = new Map()
  for (const fixture of fixtures) {
    const list = days.get(fixture.match_date) ?? []
    list.push(fixture)
    days.set(fixture.match_date, list)
  }

  for (const [day, matches] of [...days].sort(([a], [b]) => a.localeCompare(b))) {
    const date = Date.parse(day)
    if (!Number.isFinite(date)) throw new Error(`Invalid fixture date: ${day}`)

    // Snapshot all matches on the same date together. Local kickoff times and
    // match finish times are not reliable across the historical datasets.
    for (const match of matches) {
      const homeId = match.home_team.home_team_id
      const awayId = match.away_team.away_team_id
      const home = summarize(history.get(homeId) ?? [], date)
      const away = summarize(history.get(awayId) ?? [], date)
      result.set(match.match_id, [homeId, awayId, home.count, away.count, ...home.features, ...away.features])
    }

    for (const match of matches) {
      const { home_score: home, away_score: away } = match
      if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0) continue
      for (const [team, scored, allowed] of [
        [match.home_team.home_team_id, home, away],
        [match.away_team.away_team_id, away, home],
      ]) {
        const recent = history.get(team) ?? []
        history.set(team, [{ date, scored, allowed }, ...recent].slice(0, maxHistory))
      }
    }
  }

  return result
}

function splitCompetition(fixtures) {
  const ordered = [...fixtures].sort((a, b) => a.match_date.localeCompare(b.match_date) || a.match_id - b.match_id)
  if (ordered.length < 2) return { train: ordered, validation: [] }
  const cutoff = ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * 0.8))].match_date
  const train = ordered.filter((match) => match.match_date < cutoff)
  if (!train.length) return { train: ordered, validation: [] }
  return { train, validation: ordered.filter((match) => match.match_date >= cutoff) }
}

exports.buildFormContexts = buildFormContexts
exports.splitCompetition = splitCompetition
