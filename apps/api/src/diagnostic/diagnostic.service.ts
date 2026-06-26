import { EntityManager } from '@mikro-orm/core'
import { InjectQueue } from '@nestjs/bullmq'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { MockExam, User, UserCertification } from '@readion/db'
import type { MockExamGenerationJobPayload, MockExamResponse } from '@readion/shared'
import { MOCK_EXAM_GENERATION_QUEUE } from '@readion/shared'
import type { Queue } from 'bullmq'

@Injectable()
export class DiagnosticService {
  constructor(
    private readonly em: EntityManager,
    @InjectQueue(MOCK_EXAM_GENERATION_QUEUE) private readonly queue: Queue,
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
}
