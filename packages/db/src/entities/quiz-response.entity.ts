import { defineEntity, OptionalProps, p } from '@mikro-orm/core'
import type { Provenance, QuestionFormat } from '@readion/shared'
import { v4 } from 'uuid'
import { BaseSchema } from './base.entity'
import { UserCertification, UserCertificationSchema } from './user-certification.entity'

export type QuestionSnapshot = {
  question: string
  options: string[]
  correctAnswer: string
  provenance: Provenance
}

export const QuizResponseSchema = defineEntity({
  name: 'QuizResponse',
  tableName: 'quiz_responses',
  extends: BaseSchema,
  properties: {
    userCertification: p.manyToOne(UserCertificationSchema).joinColumn('user_certification_id'),
    answer: p.text(),
    correct: p.boolean(),
    confidence: p.integer(),
    timeTakenMs: p.integer(),
    questionSnapshot: p.json<QuestionSnapshot>(),
    format: p.string(),
  },
})

export class QuizResponse extends QuizResponseSchema.class {
  [OptionalProps]?: never

  override id: string = v4()
  override userCertification!: UserCertification
  override answer!: string
  override correct!: boolean
  override confidence!: number
  override timeTakenMs!: number
  override questionSnapshot!: QuestionSnapshot
  override format!: QuestionFormat
}

QuizResponseSchema.setClass(QuizResponse)
