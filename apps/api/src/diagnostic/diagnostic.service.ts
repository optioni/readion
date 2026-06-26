import { EntityManager } from '@mikro-orm/core'
import { InjectQueue } from '@nestjs/bullmq'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { MockExam, StudySession, User, UserCertification } from '@readion/db'
import type {
  DiagnosticOfferResponse,
  MockExamGenerationJobPayload,
  MockExamResponse,
} from '@readion/shared'
import { MOCK_EXAM_GENERATION_QUEUE } from '@readion/shared'
import type { Queue } from 'bullmq'
import type { EnvConfig } from '../config/env.schema'
import { deriveOffer } from './diagnostic-offer'

@Injectable()
export class DiagnosticService {
  constructor(
    private readonly em: EntityManager,
    @InjectQueue(MOCK_EXAM_GENERATION_QUEUE) private readonly queue: Queue,
    private readonly config: ConfigService<EnvConfig>,
  ) {}

  async create(userId: string, enrollmentId: string): Promise<MockExamResponse> {
    const em = this.em.fork()

    const enrollment = await em.findOne(
      UserCertification,
      { id: enrollmentId, user: userId },
      { populate: ['certification'] },
    )
    if (enrollment === null) {
      throw new NotFoundException('Enrollment not found')
    }
    if (enrollment.certification.state !== 'live') {
      throw new ConflictException('Diagnostic is only available for live certifications')
    }

    const attempt = em.create(MockExam, {
      user: em.getReference(User, userId),
      userCertification: enrollment,
      type: 'diagnostic',
      status: 'in_progress',
      startedAt: null,
      deadline: null,
      domainBreakdown: {},
      questions: [],
    })
    em.persist(attempt)
    await em.flush()

    const payload: MockExamGenerationJobPayload = { attemptId: attempt.id }
    await this.queue.add('generate', payload, {
      priority: 1,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    })

    return {
      id: attempt.id,
      userCertificationId: enrollmentId,
      type: 'diagnostic',
      status: 'in_progress',
      generation: 'preparing',
      startedAt: null,
      deadline: null,
      remainingSeconds: null,
      score: null,
      passed: null,
      domainBreakdown: {},
      questions: [],
    }
  }

  async getOffer(userId: string, enrollmentId: string): Promise<DiagnosticOfferResponse> {
    const em = this.em.fork()

    const enrollment = await em.findOne(
      UserCertification,
      { id: enrollmentId, user: userId },
      { populate: ['certification'] },
    )
    if (enrollment === null) {
      throw new NotFoundException('Enrollment not found')
    }

    const repromptAfterSessions =
      this.config.get('DIAGNOSTIC_REPROMPT_AFTER_SESSIONS', { infer: true }) ?? 1

    const [hasCompletedDiagnostic, completedSessionCount] = await Promise.all([
      em
        .count(MockExam, {
          userCertification: enrollmentId,
          type: 'diagnostic',
          status: 'submitted',
        })
        .then((n) => n > 0),
      em.count(StudySession, {
        userCertification: enrollmentId,
        status: 'completed',
      }),
    ])

    const offer = deriveOffer({
      certLive: enrollment.certification.state === 'live',
      hasCompletedDiagnostic,
      completedSessionCount,
      repromptAfterSessions,
      diagnosticRePromptedAt: enrollment.diagnosticRePromptedAt,
    })

    return { offer }
  }

  async dismissOffer(userId: string, enrollmentId: string): Promise<void> {
    const em = this.em.fork()

    const enrollment = await em.findOne(UserCertification, { id: enrollmentId, user: userId })
    if (enrollment === null) {
      throw new NotFoundException('Enrollment not found')
    }

    enrollment.diagnosticRePromptedAt = new Date()
    await em.flush()
  }
}
