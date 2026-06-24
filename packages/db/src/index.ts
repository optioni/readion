export { DbModule } from './db.module'
export { BaseEntity, BaseSchema } from './entities/base.entity'
export {
  Certification,
  CertificationSchema,
  certificationStates,
} from './entities/certification.entity'
export { User, UserRole, type UserRoleValue, UserSchema } from './entities/user.entity'
export { default as mikroOrmConfig } from './mikro-orm.config'
export { PluralUnderscoreNamingStrategy } from './naming-strategy'
export * from './test-helpers/containers'
export { createDbHarness, type DbHarness } from './test-helpers/db-harness'
export { buildHnswIndexDdl, VectorType } from './types/vector.type'
