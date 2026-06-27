import { EntityManager } from '@mikro-orm/core'
import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { EnvConfig } from '../config/env.schema'
import type { ConfiguredMailService } from '../mail/mail.service'
import { MailService } from '../mail/mail.service'
import type { DigestEnrollmentSection, DigestTemplatePayload } from '../mail/templates'
import { ReadinessService } from '../readiness/readiness.service'
import { ReviewService } from '../review/review.service'
import { WeakAreasService } from '../weak-areas/weak-areas.service'

const PRODUCT_NAME = 'Readion'
const NO_WEAK_AREA_FALLBACK = 'your recent topics'

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
    userId: string,
    unsubscribeUrl: string,
    enrollments: DigestEnrollmentInput[],
  ): Promise<DigestTemplatePayload> {
    const sections: DigestEnrollmentSection[] = []
    for (const enrollment of enrollments) {
      sections.push(await this.buildSection(userId, enrollment))
    }
    return { productName: PRODUCT_NAME, unsubscribeUrl, enrollments: sections }
  }

  private async buildSection(
    userId: string,
    enrollment: DigestEnrollmentInput,
  ): Promise<DigestEnrollmentSection> {
    const readiness = await this.readiness.compute(enrollment.id)
    if (!readiness.calibrated) {
      return { certName: enrollment.certName, calibrated: false }
    }

    const weakAreas = await this.weakAreas.listForEnrollment(userId, enrollment.id)
    const { meta } = await this.review.getQueue(userId, enrollment.id)

    return {
      certName: enrollment.certName,
      calibrated: true,
      readiness: readiness.score,
      delta: enrollment.snapshot === null ? null : readiness.score - enrollment.snapshot,
      weakestDomain: weakAreas[0]?.domain ?? NO_WEAK_AREA_FALLBACK,
      dueReviewCount: meta.dueCount,
    }
  }
}
