import { makeCounterProvider } from '@willsoto/nestjs-prometheus'
import type { Counter } from 'prom-client'

export const GROUNDING_VERIFIER_RESULTS_METRIC = 'readion_grounding_verifier_results_total'
export const GROUNDING_REGENERATIONS_METRIC = 'readion_grounding_regenerations_total'
export const GROUNDING_SUBSTITUTIONS_METRIC = 'readion_grounding_substitutions_total'
export const GROUNDING_ABSTENTIONS_METRIC = 'readion_grounding_abstentions_total'
export const GROUNDING_QUARANTINED_ITEMS_METRIC = 'readion_grounding_quarantined_items_total'

export type GroundingMetricCounters = {
  verifierResultsCounter: Counter
  regenerationsCounter: Counter
  substitutionsCounter: Counter
  abstentionsCounter: Counter
  quarantinedItemsCounter: Counter
}

export function groundingMetricProviders() {
  return [
    makeCounterProvider({
      name: GROUNDING_VERIFIER_RESULTS_METRIC,
      help: 'Grounding verifier pass/fail results',
      labelNames: ['result'],
    }),
    makeCounterProvider({
      name: GROUNDING_REGENERATIONS_METRIC,
      help: 'Number of item regenerations in grounded generation',
      labelNames: [],
    }),
    makeCounterProvider({
      name: GROUNDING_SUBSTITUTIONS_METRIC,
      help: 'Number of item substitutions after exhausting regeneration attempts',
      labelNames: [],
    }),
    makeCounterProvider({
      name: GROUNDING_ABSTENTIONS_METRIC,
      help: 'Number of agent abstentions due to thin coverage',
      labelNames: [],
    }),
    makeCounterProvider({
      name: GROUNDING_QUARANTINED_ITEMS_METRIC,
      help: 'Number of quarantined items per certification',
      labelNames: ['certification'],
    }),
  ]
}
