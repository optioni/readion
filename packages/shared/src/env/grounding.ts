import { SIMILARITY_THRESHOLD_DEFAULT } from '../content-pipeline'
import { zodCoerceNumber } from './helpers'

export const GROUNDING_MAX_REGEN_ATTEMPTS_DEFAULT = 3
export const GROUNDING_VERBATIM_CAP_DEFAULT = 500

export const groundingEnvFragment = {
  GROUNDING_MAX_REGEN_ATTEMPTS: zodCoerceNumber().default(GROUNDING_MAX_REGEN_ATTEMPTS_DEFAULT),
  GROUNDING_VERBATIM_CAP: zodCoerceNumber().default(GROUNDING_VERBATIM_CAP_DEFAULT),
  GROUNDING_SIMILARITY_THRESHOLD: zodCoerceNumber().default(SIMILARITY_THRESHOLD_DEFAULT),
}
