export const APP_NAME = 'Readion'
export const APP_VERSION = '0.1.0'

export type {
  AuthSessionResponse,
  AuthUser,
  ForgotPasswordRequest,
  LoginRequest,
  PasswordResetRequest,
  RefreshResponse,
  RegisterRequest,
  RoleValue,
} from './auth'
export {
  authSessionResponseSchema,
  authUserSchema,
  forgotPasswordRequestSchema,
  loginRequestSchema,
  passwordResetRequestSchema,
  Role,
  refreshResponseSchema,
  registerRequestSchema,
  roles,
} from './auth'
export type {
  CoverageEvaluation,
  CoverageThresholds,
  DomainCoverage,
  DomainStat,
} from './cert-coverage'
export {
  DEFAULT_MIN_CHUNKS_PER_DOMAIN,
  DEFAULT_TOTAL_CHUNK_MULTIPLE,
  evaluateCoverage,
} from './cert-coverage'
export type {
  CertificationDomain,
  CertificationFieldCitation,
  CertificationProvenance,
  CertificationResponse,
  CertificationState,
} from './certifications'
export { chunkReverseIndexKey, evictByChunkId, type RedisEvictClient } from './chunk-lifecycle'
export type { ChunkMetadata, ChunkState, ContentSourceType, DomainTag } from './content-pipeline'
export {
  CHUNK_OVERLAP_DEFAULT,
  CHUNK_SIZE_DEFAULT,
  chunkStates,
  contentSourceTypes,
  DOMAIN_CONFIDENCE_THRESHOLD_DEFAULT,
  EMBEDDING_DIMENSION,
  SIMILARITY_THRESHOLD_DEFAULT,
  SOURCE_RECHECK_INTERVALS,
} from './content-pipeline'
export {
  AI_MAX_TOKENS_DEFAULTS,
  type AiProvider,
  aiEnvFragment,
  databaseUrlFragment,
  GROUNDING_MAX_REGEN_ATTEMPTS_DEFAULT,
  GROUNDING_VERBATIM_CAP_DEFAULT,
  groundingEnvFragment,
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
export type {
  DistractorFinding,
  ExtractiveItem,
  FetchMoreMaterialSignal,
  GroundingSignal,
  Provenance,
  SubstitutionSignal,
  VerifierVerdict,
} from './grounding'
export type { PaginationQueryParams } from './pagination'
export { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from './pagination'
export type { ProblemDetails, ValidationErrorItem } from './problem-details'
export { ERROR_TYPES } from './problem-details'
export type {
  EnrollCertificationRequest,
  EnrollmentResponse,
  EnrollmentSessionOverrides,
  EnrollmentStatus,
  UpdateEnrollmentRequest,
} from './user-certifications'
export {
  enrollCertificationRequestSchema,
  enrollmentStatuses,
  updateEnrollmentRequestSchema,
} from './user-certifications'
export type { SessionDefaults, UpdateUserProfileRequest, UserProfileResponse } from './users'
export {
  DEFAULT_DISPLAY_TIMEZONE,
  DEFAULT_SESSION_DEFAULTS,
  displayTimezoneSchema,
  isSupportedTimeZone,
  sessionDefaultContentMixes,
  sessionDefaultDifficulties,
  sessionDefaultDurations,
  sessionDefaultFocusAreas,
  sessionDefaultLearningStyles,
  sessionDefaultsSchema,
  updateUserProfileRequestSchema,
  userProfileResponseSchema,
} from './users'
