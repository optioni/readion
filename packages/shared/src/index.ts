export const APP_NAME = 'Readion'
export const APP_VERSION = '0.1.0'

export type {
  AdminUserListItem,
  AuditActionValue,
  AuditLogEntry,
  QuarantinedItemDetail,
  QuarantinedItemDetailContent,
  QuarantinedItemListItem,
  QuarantinedItemStatus,
  RoleChangeResponse,
} from './admin'
export {
  AuditAction,
  auditActions,
  quarantinedItemDetailContentSchema,
  quarantinedItemStatuses,
} from './admin'
export type {
  AgentConversationMode,
  AgentConversationResponse,
  AgentMessageContent,
  AgentMessageContentPart,
  AgentMessageRequest,
  AgentMessageResponse,
  AgentMessageRole,
} from './agent'
export {
  agentConversationModes,
  agentMessageRequestSchema,
  agentMessageRoles,
} from './agent'
export type {
  AuthSessionResponse,
  AuthUser,
  ChangePasswordRequest,
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
  changePasswordRequestSchema,
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
  CertExtractionFields,
  CertExtractionResult,
  CreateCertificationRequest,
  DiscoverSourcesRequest,
  DiscoverSourcesResponse,
  DiscoveryCandidate,
  DueForReverificationItem,
  ExtractedField,
  ExtractionEnqueuedResponse,
  ExtractionStatusResponse,
  ExtractRequest,
  ReverifyCertificationRequest,
  SuggestedContentSource,
} from './certification-setup'
export {
  buildProvenanceMap,
  CERT_EXTRACTION_QUEUE,
  CERT_REVERIFICATION_INTERVAL_DAYS_DEFAULT,
  createCertificationRequestSchema,
  discoverSourcesRequestSchema,
  dueForReverification,
  extractRequestSchema,
  rankDiscoveryCandidates,
  reverifyCertificationRequestSchema,
  validateDomainWeights,
} from './certification-setup'
export type {
  CertificationDomain,
  CertificationFieldCitation,
  CertificationFieldManuallyConfirmed,
  CertificationFieldProvenance,
  CertificationFieldUnverified,
  CertificationProvenance,
  CertificationResponse,
  CertificationState,
} from './certifications'
export { chunkReverseIndexKey, evictByChunkId, type RedisEvictClient } from './chunk-lifecycle'
export type {
  ChunkMetadata,
  ChunkState,
  ContentSourceResponse,
  ContentSourceType,
  DomainTag,
  EnqueuedJobResponse,
  IngestionJobState,
  IngestionJobStatus,
  RegisterSourceRequest,
} from './content-pipeline'
export {
  CHUNK_OVERLAP_DEFAULT,
  CHUNK_SIZE_DEFAULT,
  chunkStates,
  contentSourceTypes,
  DOMAIN_CONFIDENCE_THRESHOLD_DEFAULT,
  EMBEDDING_DIMENSION,
  ingestionJobStates,
  ingestionQueueName,
  registerSourceRequestSchema,
  SIMILARITY_THRESHOLD_DEFAULT,
  SOURCE_RECHECK_INTERVALS,
} from './content-pipeline'
export {
  AI_MAX_TOKENS_DEFAULTS,
  type AiProvider,
  aiEnvFragment,
  CERT_SEARCH_MAX_RESULTS_DEFAULT,
  certSearchEnvFragment,
  type CertSearchProvider,
  dbConnectionEnvFragment,
  GROUNDING_MAX_REGEN_ATTEMPTS_DEFAULT,
  GROUNDING_VERBATIM_CAP_DEFAULT,
  groundingEnvFragment,
  lifecycleEmailApiEnvFragment,
  lifecycleEmailSharedEnvFragment,
  lifecycleEmailWorkerEnvFragment,
  observabilityEnvFragment,
  productAnalyticsEnvFragment,
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
export { isVerbatimPassage, normalizeText } from './grounding'
export type {
  ExamOutcomeRequest,
  ExamOutcomeResponse,
  LifecycleDigestRequest,
  LifecycleNudgeRequest,
} from './lifecycle-email'
export {
  DIGEST_SEND_HOUR_DEFAULT,
  DIGEST_SEND_WEEKDAY_DEFAULT,
  EXAM_READY_THRESHOLD_DEFAULT,
  examOutcomeRequestSchema,
  examOutcomeResponses,
  lifecycleEnrollmentIdsRequestSchema,
  lifecycleUserIdsRequestSchema,
  NUDGE_ACTIVITY_LULL_DAYS_DEFAULT,
  NUDGE_FOLLOWUP_DELAY_DAYS_DEFAULT,
  NUDGE_MAX_FOLLOWUPS_DEFAULT,
} from './lifecycle-email'
export type {
  DiagnosticOffer,
  DiagnosticOfferResponse,
  MockExamCitation,
  MockExamDomainBreakdown,
  MockExamDomainStat,
  MockExamGeneration,
  MockExamGenerationJobPayload,
  MockExamQuestion,
  MockExamQuestionResponse,
  MockExamResponse,
  MockExamStatus,
  MockExamType,
  SaveAnswerRequest,
} from './mock-exam'
export {
  diagnosticOffers,
  MOCK_EXAM_GENERATION_QUEUE,
  mockExamGenerations,
  mockExamStatuses,
  mockExamTypes,
  saveAnswerRequestSchema,
} from './mock-exam'
export type { PaginationQueryParams } from './pagination'
export { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from './pagination'
export type { ProblemDetails, ValidationErrorItem } from './problem-details'
export { ERROR_TYPES } from './problem-details'
export type {
  AnalyticsMetric,
  AnalyticsOverview,
  AnalyticsOverviewResponse,
  AnalyticsTargetedMetric,
  AnalyticsTargetedMetricKey,
  PassRateBreakdown,
  PassRateMetric,
  RetentionCohort,
  RetentionMetric,
} from './product-analytics'
export {
  ANALYTICS_ACTIVE_MIN_SESSIONS_DEFAULT,
  ANALYTICS_ACTIVE_WINDOW_DAYS_DEFAULT,
  ANALYTICS_COST_AGENT_MESSAGE_DEFAULT,
  ANALYTICS_COST_MOCK_QUESTION_DEFAULT,
  ANALYTICS_COST_QUIZ_DEFAULT,
  ANALYTICS_COST_SESSION_ITEM_DEFAULT,
  ANALYTICS_LLM_COST_BUDGET_DEFAULT,
  ANALYTICS_METRIC_TARGET_ENV_KEYS,
  ANALYTICS_NORTHSTAR_WINDOW_DAYS_DEFAULT,
  ANALYTICS_TARGET_AGENT_ENGAGEMENT_DEFAULT,
  ANALYTICS_TARGET_COMPLETION_RATE_DEFAULT,
  ANALYTICS_TARGET_NORTHSTAR_GAIN_DEFAULT,
  ANALYTICS_TARGET_SESSIONS_PER_WEEK_DEFAULT,
  ANALYTICS_TARGET_W4_RETENTION_DEFAULT,
} from './product-analytics'
export type {
  ExplanationRequest,
  ExplanationResponse,
  GenerateQuizRequest,
  InsufficientMaterialResponse,
  QuestionFormat,
  QuizAnsweredEvent,
  QuizDifficulty,
  QuizGenerationResult,
  QuizQuestionResponse,
  ReportRequest,
  SubmitAnswerRequest,
  SubmitAnswerResponse,
} from './quiz'
export {
  explanationRequestSchema,
  generateQuizRequestSchema,
  QUIZ_ANSWERED_EVENT,
  questionFormats,
  quizDifficulties,
  reportRequestSchema,
  submitAnswerRequestSchema,
} from './quiz'
export type { ReadinessResponse, ReadinessTrajectory } from './readiness'
export { READINESS_CALIBRATION_MIN_ANSWERS_DEFAULT } from './readiness'
export type {
  GradeReviewItemRequest,
  ReviewGrade,
  ReviewItemResponse,
  ReviewItemState,
  ReviewQueueMeta,
  StartReviewResponse,
  SuppressDomainRequest,
  SuppressDomainResponse,
} from './review'
export {
  gradeReviewItemRequestSchema,
  LEITNER_CONFIDENT_THRESHOLD,
  LEITNER_EASY_PROMOTION_DEFAULT,
  LEITNER_INTERVALS_DAYS_DEFAULT,
  REVIEW_SESSION_QUESTION_CAP_DEFAULT,
  reviewGrades,
  reviewItemStates,
  suppressDomainRequestSchema,
} from './review'
export type {
  DrillResultResponse,
  SessionQuestionRef,
  SessionReadinessChange,
  SessionSummaryDomainStat,
  SessionSummaryResponse,
  WeakAreaDelta,
} from './session-summary'
export {
  SUMMARY_DRILL_MAX_QUESTIONS,
  SUMMARY_UNSURE_CONFIDENCE_THRESHOLD,
} from './session-summary'
export type {
  CreateSessionRequest,
  SessionConfig,
  SessionContentMix,
  SessionDifficulty,
  SessionDurationMinutes,
  SessionFillJobPayload,
  SessionFocusArea,
  SessionItemPlan,
  SessionItemResponse,
  SessionItemType,
  SessionKind,
  SessionLearningStyle,
  SessionListMeta,
  SessionResponse,
  SessionStatus,
  SessionWithItemsResponse,
} from './sessions'
export {
  createSessionRequestSchema,
  SESSION_FILL_QUEUE,
  sessionContentMixes,
  sessionDifficulties,
  sessionDurationMinutes,
  sessionFocusAreaSchema,
  sessionItemTypes,
  sessionKinds,
  sessionLearningStyles,
  sessionStatuses,
} from './sessions'
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
