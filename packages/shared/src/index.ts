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
  CertificationDomain,
  CertificationFieldCitation,
  CertificationProvenance,
  CertificationResponse,
  CertificationState,
} from './certifications'
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
