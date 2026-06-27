import { EntityManager } from '@mikro-orm/core'
import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { EnvConfig } from '../config/env.schema'
import type { ConfiguredMailService } from '../mail/mail.service'
import { MailService } from '../mail/mail.service'
import type { DigestTemplatePayload } from '../mail/templates'
import { ReadinessService } from '../readiness/readiness.service'
import { ReviewService } from '../review/review.service'
import { WeakAreasService } from '../weak-areas/weak-areas.service'

export type DigestEnrollmentInput = {
  id: string
  certName: string
  snapshot: number | null
}

@Injectable()
export class LifecycleEmailService {
  constructor(
    private readonly em: EntityManager,
    private readonly readiness: ReadinessService,
    private readonly weakAreas: WeakAreasService,
    private readonly review: ReviewService,
    @Inject(MailService)
    private readonly mail: ConfiguredMailService,
    private readonly config: ConfigService<EnvConfig>,
  ) {}

  async assembleDigest(
    _userId: string,
    _unsubscribeUrl: string,
    _enrollments: DigestEnrollmentInput[],
  ): Promise<DigestTemplatePayload> {
    throw new Error('Not implemented')
  }
}
