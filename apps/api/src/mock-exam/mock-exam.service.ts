import { EntityManager } from '@mikro-orm/core'
import { InjectQueue } from '@nestjs/bullmq'
import { Injectable, NotFoundException } from '@nestjs/common'
import { MockExam, User, UserCertification } from '@readion/db'
import type {
  MockExamCitation,
  MockExamGeneration,
  MockExamGenerationJobPayload,
  MockExamQuestion,
  MockExamQuestionResponse,
  MockExamResponse,
} from '@readion/shared'
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

  async findOne(userId: string, attemptId: string): Promise<MockExamResponse> {
    const em = this.em.fork()

    const attempt = await em.findOne(MockExam, { id: attemptId, user: userId })
    if (attempt === null) {
      throw new NotFoundException('Mock exam not found')
    }

    return mapMockExamToResponse(attempt)
  }
}

function deriveGeneration(attempt: MockExam): MockExamGeneration {
  return attempt.deadline === null ? 'preparing' : 'ready'
}

function deriveRemainingSeconds(attempt: MockExam): number | null {
  if (attempt.deadline === null) {
    return null
  }
  const ms = attempt.deadline.getTime() - Date.now()
  return Math.max(0, Math.floor(ms / 1000))
}

function buildCitations(provenance: MockExamQuestion['provenance']): MockExamCitation[] {
  const { sourceChunkIds, supportingSpans } = provenance
  const length = Math.max(sourceChunkIds.length, supportingSpans.length)
  return Array.from({ length }, (_, i) => ({
    chunkId: sourceChunkIds[i] ?? '',
    text: supportingSpans[i] ?? '',
  }))
}

function mapQuestion(q: MockExamQuestion, isTerminal: boolean): MockExamQuestionResponse {
  const base: MockExamQuestionResponse = {
    id: q.id,
    question: q.question,
    options: q.options,
    domain: q.domain,
    userAnswer: q.selectedAnswer,
  }

  if (!isTerminal) {
    return base
  }

  return {
    ...base,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    citations: buildCitations(q.provenance),
  }
}

function mapMockExamToResponse(attempt: MockExam): MockExamResponse {
  const isTerminal = attempt.status === 'submitted' || attempt.status === 'expired'

  return {
    id: attempt.id,
    userCertificationId:
      typeof attempt.userCertification === 'string'
        ? attempt.userCertification
        : attempt.userCertification.id,
    type: attempt.type,
    status: attempt.status,
    generation: deriveGeneration(attempt),
    startedAt: attempt.startedAt ? attempt.startedAt.toISOString() : null,
    deadline: attempt.deadline ? attempt.deadline.toISOString() : null,
    remainingSeconds: deriveRemainingSeconds(attempt),
    score: attempt.score,
    passed: attempt.passed,
    domainBreakdown: attempt.domainBreakdown,
    questions: (attempt.questions ?? []).map((q) => mapQuestion(q, isTerminal)),
  }
}
