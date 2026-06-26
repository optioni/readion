import { EntityManager } from '@mikro-orm/core'
import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { MockExam, User, UserCertification } from '@readion/db'
import type { MockExamGenerationJobPayload, MockExamResponse } from '@readion/shared'
import { MOCK_EXAM_GENERATION_QUEUE } from '@readion/shared'
import type { Queue } from 'bullmq'

@Injectable()
export class MockExamService {
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

    const attempt = em.create(MockExam, {
      user: em.getReference(User, userId),
      userCertification: enrollment,
      type: 'mock',
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

    return mapMockExamToResponse(attempt)
  }
}

function mapMockExamToResponse(attempt: MockExam): MockExamResponse {
  return {
    id: attempt.id,
    userCertificationId:
      typeof attempt.userCertification === 'string'
        ? attempt.userCertification
        : attempt.userCertification.id,
    type: attempt.type,
    status: attempt.status,
    startedAt: attempt.startedAt ? attempt.startedAt.toISOString() : null,
    deadline: attempt.deadline ? attempt.deadline.toISOString() : null,
    score: attempt.score,
    passed: attempt.passed,
    domainBreakdown: attempt.domainBreakdown,
    questions: attempt.questions,
  }
}
