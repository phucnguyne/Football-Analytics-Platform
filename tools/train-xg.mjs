import { writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { execFileSync } from 'node:child_process'
import { shotFeatures, probability, teamFormFeatures } from '../apps/web/src/models/xg-features.cjs'
import { loadXgDataset, statsBombRevision, maxMatchesPerSeason } from './xg-dataset.mjs'
import { buildFormContexts, splitCompetition } from './xg-form.cjs'

const args = process.argv.slice(2)
const download = args[0] === '--download'
if (download) args.shift()
const [input, providedRevision] = args
if (!input) {
  console.error('Usage: node tools/train-xg.mjs [--download] <StatsBomb data or cache directory> [dataset revision]')
  process.exit(1)
}
const revision = providedRevision ?? (download ? statsBombRevision
  : execFileSync('git', ['-C', dirname(resolve(input)), 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim())

const { seasons, events, sampled } = await loadXgDataset(input, { download, revision })
const contexts = new Map()
const competitions = new Map()
for (const season of seasons) {
  const { competition_id: id, competition_name: name, country_name: country, competition_gender: gender } = season.competition
  const competition = competitions.get(id) ?? { id, name, country, gender, seasons: 0, fixtures: [], availableMatches: 0 }
  competition.seasons++
  competition.availableMatches += season.fixtures.length
  competition.fixtures.push(...season.sample)
  competitions.set(id, competition)
  for (const [matchId, form] of buildFormContexts(season.fixtures)) {
    if (contexts.has(matchId)) throw new Error(`Duplicate fixture ${matchId}`)
    contexts.set(matchId, form)
  }
}

function examples(fixtures) {
  return fixtures.flatMap(({ match_id: id }) => events.get(id).flatMap((shot) => {
    const features = shotFeatures(shot)
    if (!features) return []
    const previous = teamFormFeatures(contexts.get(id), shot.team?.id)
    const context = previous ?? [0, 0, 0, 0, 0, 0]
    return [{ shot: features, withForm: [...features, ...context], usesForm: !!previous, goal: Number(shot.shot.outcome.name === 'Goal') }]
  }))
}

const training = []
const validation = []
let trainingMatches = 0
let validationMatches = 0
const coverage = [...competitions.values()].map(({ fixtures, ...competition }) => {
  const split = splitCompetition(fixtures)
  const train = examples(split.train)
  const test = examples(split.validation)
  if (train.length === 0) throw new Error(`No training shots for ${competition.name}`)
  training.push(...train)
  validation.push(...test)
  trainingMatches += split.train.length
  validationMatches += split.validation.length
  return {
    ...competition,
    trainingMatches: split.train.length, trainingShots: train.length,
    validationMatches: split.validation.length, validationShots: test.length,
    validationExamples: test,
  }
})
if (!validation.length) throw new Error('No held-out shots available')

function trainModel(feature) {
  const weights = Array(training[0][feature].length).fill(0)
  const gradient = weights.map(() => 0)
  for (let iteration = 0; iteration < 1800; iteration++) {
    gradient.fill(0)
    for (const sample of training) {
      const values = sample[feature]
      const error = probability(values, weights) - sample.goal
      for (let index = 0; index < weights.length; index++) gradient[index] += error * values[index]
    }
    for (let index = 0; index < weights.length; index++) {
      const penalty = index === 0 ? 0 : 0.002 * weights[index]
      weights[index] -= 0.2 * (gradient[index] / training.length + penalty)
    }
  }
  return weights.map((value) => Number(value.toFixed(10)))
}

function evaluate(samples, predict) {
  if (!samples.length) return null
  let brier = 0
  let logLoss = 0
  for (const sample of samples) {
    const p = Math.min(1 - 1e-8, Math.max(1e-8, predict(sample)))
    brier += (p - sample.goal) ** 2
    logLoss -= sample.goal * Math.log(p) + (1 - sample.goal) * Math.log(1 - p)
  }
  return { brier: Number((brier / samples.length).toFixed(5)), logLoss: Number((logLoss / samples.length).toFixed(5)) }
}

const weights = trainModel('withForm')
const shotOnlyWeights = trainModel('shot')
const baseRate = training.reduce((sum, shot) => sum + shot.goal, 0) / training.length
const predict = (sample) => sample.usesForm ? probability(sample.withForm, weights) : probability(sample.shot, shotOnlyWeights)
const baseline = () => baseRate
const artifact = {
  name: 'StatsBomb multi-league xG v2',
  source: 'https://github.com/hudl/open-data',
  revision,
  weights,
  shotOnlyWeights,
  publicMatchIds: [...contexts.keys()].sort((a, b) => a - b),
  formContexts: Object.fromEntries(contexts),
  training: {
    competitions: coverage.length, seasons: seasons.length, matches: trainingMatches,
    shots: training.length, withForm: training.filter((shot) => shot.usesForm).length,
    maxMatchesPerSeason, sampledMatches: sampled,
  },
  validation: {
    method: 'Chronological holdout within each competition, grouped by date',
    matches: validationMatches, shots: validation.length, withForm: validation.filter((shot) => shot.usesForm).length,
    model: evaluate(validation, predict),
    shotOnly: evaluate(validation, (sample) => probability(sample.shot, shotOnlyWeights)),
    baseline: evaluate(validation, baseline),
  },
  coverage: coverage.map(({ validationExamples, ...competition }) => ({
    ...competition,
    model: evaluate(validationExamples, predict),
    baseline: evaluate(validationExamples, baseline),
  })),
}
await writeFile(new URL('../apps/web/src/models/xg-model.json', import.meta.url), JSON.stringify(artifact) + '\n')
console.log(JSON.stringify({ training: artifact.training, validation: artifact.validation }, null, 2))
