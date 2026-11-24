import model from '@/models/xg-model.json'
import { probability, shotFeatures, teamFormFeatures } from '@/models/xg-features.cjs'

type ShotEvent = Parameters<typeof shotFeatures>[0] & { team?: { id?: number } }

export const xgModelInfo = {
  name: model.name,
  source: model.source,
  revision: model.revision,
  training: model.training,
  validation: model.validation,
}

export const publicStatsBombMatches = new Set(model.publicMatchIds)
const contexts: Record<string, number[] | undefined> = model.formContexts

export function matchFormHistory(matchId: number) {
  const context = contexts[matchId]
  return context ? { homeMatches: context[2], awayMatches: context[3] } : null
}

export function estimateShotXg(event: ShotEvent, matchId?: number) {
  const features = shotFeatures(event)
  if (!features) return { xG: null, usesForm: false }

  const form = matchId === undefined ? null : teamFormFeatures(contexts[matchId], event.team?.id)
  if (!form) return { xG: probability(features, model.shotOnlyWeights), usesForm: false }

  return { xG: probability([...features, ...form], model.weights), usesForm: true }
}
