import { defineEntity, OptionalProps, p } from '@mikro-orm/core'
import type { ReviewItemState } from '@readion/shared'
import { v4 } from 'uuid'
import { BaseSchema } from './base.entity'
import { UserCertification, UserCertificationSchema } from './user-certification.entity'

export const ReviewItemSchema = defineEntity({
  name: 'ReviewItem',
  tableName: 'review_items',
  extends: BaseSchema,
  properties: {
    userCertification: p.manyToOne(UserCertificationSchema).joinColumn('user_certification_id'),
    anchorChunkId: p.uuid(),
    box: p.integer().default(1),
    state: p.enum(['active', 'mastered', 'suppressed']).default('active'),
    dueAt: p.datetime(),
    lastReviewedAt: p.datetime().nullable(),
  },
})

export class ReviewItem extends ReviewItemSchema.class {
  [OptionalProps]?: 'box' | 'state' | 'lastReviewedAt'

  override id: string = v4()
  override userCertification!: UserCertification
  override anchorChunkId!: string
  override box: number = 1
  override state: ReviewItemState = 'active'
  override dueAt!: Date
  override lastReviewedAt: Date | null = null
}

ReviewItemSchema.setClass(ReviewItem)
