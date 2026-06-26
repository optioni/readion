export { DbModule } from './db.module'
export { BaseEntity, BaseSchema } from './entities/base.entity'
export {
  Certification,
  CertificationSchema,
  certificationStates,
} from './entities/certification.entity'
export { ContentChunk, ContentChunkSchema } from './entities/content-chunk.entity'
export { ContentSource, ContentSourceSchema } from './entities/content-source.entity'
export {
  type QuestionSnapshot,
  QuizResponse,
  QuizResponseSchema,
} from './entities/quiz-response.entity'
export { MockExam, MockExamSchema } from './entities/mock-exam.entity'
export { ReviewItem, ReviewItemSchema } from './entities/review-item.entity'
export { SessionItem, SessionItemSchema } from './entities/session-item.entity'
export { StudySession, StudySessionSchema } from './entities/study-session.entity'
export { User, UserRole, type UserRoleValue, UserSchema } from './entities/user.entity'
export {
  UserCertification,
  UserCertificationSchema,
  userCertificationStatuses,
} from './entities/user-certification.entity'
export { WeakArea, WeakAreaSchema } from './entities/weak-area.entity'
export { default as mikroOrmConfig } from './mikro-orm.config'
export { PluralUnderscoreNamingStrategy } from './naming-strategy'
export { type CoverageStats, queryCoverageStats } from './queries/coverage-stats.query'
export * from './test-helpers/containers'
export { createDbHarness, type DbHarness } from './test-helpers/db-harness'
export { buildHnswIndexDdl, VectorType } from './types/vector.type'
