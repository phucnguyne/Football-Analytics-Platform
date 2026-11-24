// StatsBomb's event coordinates use a 120 × 80 pitch with shots facing x=120.
/**
 * @param {{ period?: number, location?: number[], under_pressure?: boolean, shot?: { body_part?: { name?: string }, type?: { name?: string }, first_time?: boolean, one_on_one?: boolean } }} event
 */
function shotFeatures(event) {
  const [x, y] = event.location ?? []
  if (!event.shot || (event.period ?? 1) > 4 || !Number.isFinite(x) || !Number.isFinite(y) ||
      x < 0 || x > 120 || y < 0 || y > 80) return null

  const depth = 120 - x
  const lateral = y - 40
  const goalWidth = 8
  const distance = Math.hypot(depth, lateral)
  const angle = Math.atan2(goalWidth * depth, depth * depth + lateral * lateral - goalWidth ** 2 / 4)
  const header = Number(event.shot.body_part?.name === 'Head')

  return [
    1, distance / 20, angle, header, angle * header,
    Number(event.shot.type?.name === 'Penalty'),
    Number(event.shot.type?.name === 'Free Kick'),
    Number(event.under_pressure === true),
    Number(event.shot.first_time === true),
    Number(event.shot.one_on_one === true),
  ]
}

/** @param {number[]} features @param {number[]} weights */
function probability(features, weights) {
  const score = features.reduce((sum, value, index) => sum + value * weights[index], 0)
  return 1 / (1 + Math.exp(-score))
}

exports.shotFeatures = shotFeatures
exports.probability = probability

/**
 * @param {number[] | undefined} context [home id, away id, home count, away count, three form features per side]
 * @param {number | undefined} teamId
 */
function teamFormFeatures(context, teamId) {
  if (!context || !(context[2] || context[3])) return null
  const home = context.slice(4, 7)
  const away = context.slice(7, 10)
  if (teamId === context[0]) return [...home, ...away]
  if (teamId === context[1]) return [...away, ...home]
  return null
}

exports.teamFormFeatures = teamFormFeatures
