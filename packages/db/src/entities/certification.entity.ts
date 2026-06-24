import { defineEntity, OptionalProps, p } from '@mikro-orm/core'
import type {
  CertificationDomain,
  CertificationProvenance,
  CertificationState,
} from '@readion/shared'
import { v4 } from 'uuid'
import { BaseSchema } from './base.entity'

export const certificationStates = ['draft', 'live'] as const

export const CertificationSchema = defineEntity({
  name: 'Certification',
  tableName: 'certifications',
  extends: BaseSchema,
  properties: {
    name: p.string(),
    provider: p.string(),
    code: p.string(),
    domains: p.json<CertificationDomain[]>(),
    questionCount: p.integer(),
    passingScore: p.float(),
    timeLimitMinutes: p.integer(),
    state: p.enum([...certificationStates]).default('draft'),
    provenance: p.json<CertificationProvenance>(),
    verifiedAt: p.datetime().nullable(),
  },
})

export class Certification extends CertificationSchema.class {
  [OptionalProps]?: 'state' | 'verifiedAt'

  override id: string = v4()
  override name!: string
  override provider!: string
  override code!: string
  override domains!: CertificationDomain[]
  override questionCount!: number
  override passingScore!: number
  override timeLimitMinutes!: number
  override state: CertificationState = 'draft'
  override provenance!: CertificationProvenance
  override verifiedAt: Date | null = null
}

CertificationSchema.setClass(Certification)
