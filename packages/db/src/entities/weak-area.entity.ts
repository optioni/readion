import { defineEntity, OptionalProps, p } from '@mikro-orm/core'
import { v4 } from 'uuid'
import { BaseSchema } from './base.entity'
import { UserCertification, UserCertificationSchema } from './user-certification.entity'

export const WeakAreaSchema = defineEntity({
  name: 'WeakArea',
  tableName: 'weak_areas',
  extends: BaseSchema,
  uniques: [{ properties: ['userCertification', 'domain'] }],
  properties: {
    userCertification: p.manyToOne(UserCertificationSchema).joinColumn('user_certification_id'),
    domain: p.string(),
    score: p.float(),
    accuracy: p.float(),
    meanConfidence: p.float(),
    responseCount: p.integer(),
  },
})

export class WeakArea extends WeakAreaSchema.class {
  [OptionalProps]?: never

  override id: string = v4()
  override userCertification!: UserCertification
  override domain!: string
  override score!: number
  override accuracy!: number
  override meanConfidence!: number
  override responseCount!: number
}

WeakAreaSchema.setClass(WeakArea)
