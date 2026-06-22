export const APP_NAME = 'Readion'
export const APP_VERSION = '0.1.0'

export {
  databaseUrlFragment,
  observabilityEnvFragment,
  redisUrlFragment,
  workerPrometheusFragment,
  zodCoerceBoolean,
  zodCoerceNumber,
  zodRequiredUrl,
} from './env'
export type {
  CollectionEnvelope,
  CollectionMeta,
  RelationshipRef,
  SingleResourceEnvelope,
} from './envelope'
export type { PaginationQueryParams } from './pagination'
export { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from './pagination'
export type { ProblemDetails, ValidationErrorItem } from './problem-details'
export { ERROR_TYPES } from './problem-details'
