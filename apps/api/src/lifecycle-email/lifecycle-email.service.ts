import { randomBytes } from 'node:crypto'
import { EntityManager } from '@mikro-orm/core'
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { User, UserCertification } from '@readion/db'
import type { ExamOutcomeResponse } from '@readion/shared'
import { InjectMetric } from '@willsoto/nestjs-prometheus'
import type { Counter } from 'prom-client'
import type { EnvConfig } from '../config/env.schema'
import type { ConfiguredMailService } from '../mail/mail.service'
import { MailService } from '../mail/mail.service'
import type {
  DigestEnrollmentSection,
  DigestTemplatePayload,
  ExamNudgeTemplatePayload,
} from '../mail/templates'
import { ReadinessService } from '../readiness/readiness.service'
import { ReviewService } from '../review/review.service'
import { WeakAreasService } from '../weak-areas/weak-areas.service'
import { buildEnrollmentSection } from './digest-assembly'
import { LIFECYCLE_EMAILS_SENT_METRIC, type LifecycleEmailType } from './lifecycle-email.metrics'
import { shouldSendNudge } from './nudge-policy'

const PRODUCT_NAME = 'Readion'

export type DigestEnrollmentInput = {
  id: string
  certName: string
  snapshot: number | null
}

@Injectable()
export class LifecycleEmailService {
  private readonly logger = new Logger(LifecycleEmailService.name)

  constructor(
    private readonly em: EntityManager,
    private readonly readiness: ReadinessService,
    private readonly weakAreas: WeakAreasService,
    private readonly review: ReviewService,
    @Inject(MailService)
    private readonly mail: ConfiguredMailService,
    private readonly config: ConfigService<EnvConfig>,
    @InjectMetric(LIFECYCLE_EMAILS_SENT_METRIC)
    private readonly emailsSent: Counter,
  ) {}

  // Observability is best-effort: a metrics failure must never break an email send.
  private recordEmailSent(type: LifecycleEmailType): void {
    try {
      this.emailsSent.inc({ type })
    } catch (error: unknown) {
      this.logger.warn(`Failed to record lifecycle email metric (${type})`, error)
    }
  }

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
    this.recordEmailSent('digest')

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

  async maybeSendNudge(userCertificationId: string, now: Date = new Date()): Promise<void> {
    const em = this.em.fork()
    const enrollment = await em.findOne(
      UserCertification,
      { id: userCertificationId },
      { populate: ['user', 'certification'] },
    )
    if (enrollment === null) {
      return
    }

    const allowed = shouldSendNudge({
      now,
      examOutcomeResponse: enrollment.examOutcomeResponse,
      nudgeCount: enrollment.examOutcomeNudgeCount,
      nudgeSentAt: enrollment.examOutcomeNudgeSentAt,
      maxFollowups: Number(this.config.get('NUDGE_MAX_FOLLOWUPS', { infer: true })),
      followupDelayDays: Number(this.config.get('NUDGE_FOLLOWUP_DELAY_DAYS', { infer: true })),
    })
    if (!allowed) {
      return
    }

    const readiness = await this.readiness.compute(userCertificationId)
    const threshold = Number(this.config.get('EXAM_READY_THRESHOLD', { infer: true }))
    if (!readiness.calibrated || readiness.score < threshold) {
      return
    }

    const payload: ExamNudgeTemplatePayload = {
      productName: PRODUCT_NAME,
      certName: enrollment.certification.name,
    }
    await this.mail.send('exam-nudge', enrollment.user.email, payload)
    this.recordEmailSent('nudge')

    enrollment.examOutcomeNudgeSentAt = now
    enrollment.examOutcomeNudgeCount += 1
    await em.flush()
  }

  // `examOutcomeResponse`/`examOutcomeRespondedAt` are write-only-for-analytics: they
  // feed the self-reported pass-rate metric and are read by no readiness/weak-area path.
  async recordExamOutcome(
    userId: string,
    enrollmentId: string,
    response: ExamOutcomeResponse,
  ): Promise<{ response: ExamOutcomeResponse; respondedAt: Date }> {
    const em = this.em.fork()
    const enrollment = await em.findOne(UserCertification, { id: enrollmentId, user: userId })
    if (enrollment === null) {
      throw new NotFoundException('Enrollment not found')
    }

    const respondedAt = new Date()
    enrollment.examOutcomeResponse = response
    enrollment.examOutcomeRespondedAt = respondedAt
    await em.flush()

    return { response, respondedAt }
  }

  async unsubscribe(token: string): Promise<void> {
    if (token.trim() === '') {
      return
    }

    const em = this.em.fork()
    const user = await em.findOne(User, { unsubscribeToken: token })
    if (user === null || user.digestOptOut) {
      return
    }

    user.digestOptOut = true
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
