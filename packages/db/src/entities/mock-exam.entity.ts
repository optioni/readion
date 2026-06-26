import { defineEntity, OptionalProps, p } from '@mikro-orm/core'
import type {
  MockExamDomainBreakdown,
  MockExamQuestion,
  MockExamStatus,
  MockExamType,
} from '@readion/shared'
import { v4 } from 'uuid'
import { BaseSchema } from './base.entity'
import { User, UserSchema } from './user.entity'
import { UserCertification, UserCertificationSchema } from './user-certification.entity'

export const MockExamSchema = defineEntity({
  name: 'MockExam',
  tableName: 'mock_exams',
  extends: BaseSchema,
  properties: {
    user: p.manyToOne(UserSchema).joinColumn('user_id'),
    userCertification: p.manyToOne(UserCertificationSchema).joinColumn('user_certification_id'),
    type: p.enum(['mock', 'diagnostic']).default('mock'),
    status: p.enum(['in_progress', 'submitted', 'expired']).default('in_progress'),
    startedAt: p.datetime().nullable(),
    deadline: p.datetime().nullable(),
    score: p.float().nullable(),
    passed: p.boolean().nullable(),
    domainBreakdown: p.json<MockExamDomainBreakdown>(),
    questions: p.json<MockExamQuestion[]>(),
  },
})

export class MockExam extends MockExamSchema.class {
  [OptionalProps]?: 'type' | 'status' | 'startedAt' | 'deadline' | 'score' | 'passed'

  override id: string = v4()
  override user!: User
  override userCertification!: UserCertification
  override type: MockExamType = 'mock'
  override status: MockExamStatus = 'in_progress'
  override startedAt: Date | null = null
  override deadline: Date | null = null
  override score: number | null = null
  override passed: boolean | null = null
  override domainBreakdown!: MockExamDomainBreakdown
  override questions!: MockExamQuestion[]
}

MockExamSchema.setClass(MockExam)
