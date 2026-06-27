import { randomBytes } from 'node:crypto'
import { EntityManager } from '@mikro-orm/core'
import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { User, UserCertification } from '@readion/db'
import type { EnvConfig } from '../config/env.schema'
import type { ConfiguredMailService } from '../mail/mail.service'
import { MailService } from '../mail/mail.service'
import type { DigestEnrollmentSection, DigestTemplatePayload } from '../mail/templates'
import { ReadinessService } from '../readiness/readiness.service'
import { ReviewService } from '../review/review.service'
import { WeakAreasService } from '../weak-areas/weak-areas.service'
import { buildEnrollmentSection } from './digest-assembly'

const PRODUCT_NAME = 'Readion'

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

  async sendDigest(userId: string): Promise<void> {
    const em = this.em.fork()
    const user = await em.findOne(User, { id: userId })
    if (user === null || user.digestOptOut) {
      return
    }

    const enrollments = await em.find(
      UserCertification,
      { user: userId, status: 'active' },
      { populate: ['certification'] },
    )
    if (enrollments.length === 0) {
      return
    }

    if (user.unsubscribeToken === null) {
      user.unsubscribeToken = randomBytes(32).toString('base64url')
    }
    const unsubscribeUrl = this.buildUnsubscribeUrl(user.unsubscribeToken)

    const inputs: DigestEnrollmentInput[] = enrollments.map((enrollment) => ({
      id: enrollment.id,
      certName: enrollment.certification.name,
      snapshot: enrollment.lastDigestReadiness,
    }))

    const payload = await this.assembleDigest(userId, unsubscribeUrl, inputs)
    await this.mail.send('digest', user.email, payload)

    user.lastDigestSentAt = new Date()
    // `payload.enrollments` preserves the order of `enrollments`/`inputs`, so the
    // calibrated readiness for index i is the snapshot to persist for enrollments[i].
    enrollments.forEach((enrollment, index) => {
      const section = payload.enrollments[index]
      if (section?.calibrated) {
        enrollment.lastDigestReadiness = section.readiness
      }
    })
    await em.flush()
  }

  private buildUnsubscribeUrl(token: string): string {
    const url = new URL('/api/v1/email/unsubscribe', this.config.getOrThrow('PUBLIC_API_URL'))
    url.searchParams.set('token', token)
    return url.toString()
  }

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
      return buildEnrollmentSection({
        certName: enrollment.certName,
        readiness,
        snapshot: enrollment.snapshot,
        weakAreas: [],
        dueReviewCount: 0,
      })
    }

    const weakAreas = await this.weakAreas.listForEnrollment(userId, enrollment.id)
    const { meta } = await this.review.getQueue(userId, enrollment.id)

    return buildEnrollmentSection({
      certName: enrollment.certName,
      readiness,
      snapshot: enrollment.snapshot,
      weakAreas,
      dueReviewCount: meta.dueCount,
    })
  }
}
