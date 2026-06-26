import { EntityManager } from '@mikro-orm/core'
import { InjectQueue } from '@nestjs/bullmq'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { MockExam, QuizResponse, User, UserCertification } from '@readion/db'
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
import type { CollectionResult } from '../common/interceptors/response.interceptor'
import type { EnvConfig } from '../config/env.schema'
import { WeakAreasService } from '../weak-areas/weak-areas.service'
import { MockExamScorer } from './mock-exam-scorer'

@Injectable()
export class MockExamService {
  constructor(
    private readonly em: EntityManager,
    @InjectQueue(MOCK_EXAM_GENERATION_QUEUE) private readonly queue: Queue,
    private readonly scorer: MockExamScorer,
    private readonly weakAreas: WeakAreasService,
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
    const attempt = await this.findOwnedAttempt(em, userId, attemptId)
    return mapMockExamToResponse(attempt)
  }

  async listForEnrollment(
    userId: string,
    enrollmentId: string,
    page = 1,
    limit = 25,
  ): Promise<CollectionResult<MockExamResponse>> {
    const em = this.em.fork()

    const enrollment = await em.findOne(UserCertification, { id: enrollmentId, user: userId })
    if (enrollment === null) {
      throw new NotFoundException('Enrollment not found')
    }

    const effectiveLimit = Math.min(limit, 100)
    const offset = (page - 1) * effectiveLimit

    const [attempts, total] = await em.findAndCount(
      MockExam,
      { userCertification: enrollmentId },
      { orderBy: { id: 'DESC' }, limit: effectiveLimit, offset },
    )

    return {
      items: attempts.map(mapMockExamToResponse),
      meta: { total, page, limit: effectiveLimit },
    }
  }

  async submit(userId: string, attemptId: string): Promise<MockExamResponse> {
    const em = this.em.fork()

    const attempt = await this.findOwnedAttempt(em, userId, attemptId)
    await em.populate(attempt, ['userCertification', 'userCertification.certification'])

    if (attempt.status !== 'in_progress') {
      throw new ConflictException('Attempt is already submitted or expired')
    }

    const acted = await this.finalizeAttempt(em, attempt, 'submitted')
    if (!acted) {
      throw new ConflictException('Attempt is already submitted or expired')
    }

    return mapMockExamToResponse(attempt)
  }

  /**
   * Scores, persists the result, emits QuizResponses, and drives weak-area
   * recompute for a completed attempt. Parameterised by terminalStatus so
   * both the manual submit path ('submitted') and the auto-submit cron path
   * ('expired') share identical scoring behaviour.
   *
   * Race guard: re-reads the attempt status from DB before transitioning so that
   * a concurrent manual submit (which commits before the cron's finalizeAttempt
   * executes) is detected and the second writer no-ops — preventing duplicate
   * QuizResponse emission and double weak-area recompute.
   */
  async finalizeAttempt(
    em: EntityManager,
    attempt: MockExam,
    terminalStatus: 'submitted' | 'expired',
  ): Promise<boolean> {
    await em.refresh(attempt)
    if (attempt.status !== 'in_progress') {
      return false
    }

    const cert = attempt.userCertification.certification
    const result = this.scorer.score(attempt.questions, cert.domains, cert.passingScore / 1000)

    attempt.status = terminalStatus
    attempt.score = result.score
    attempt.passed = result.passed
    attempt.domainBreakdown = result.domainBreakdown

    const neutralConfidence = this.config.get('MOCK_EXAM_NEUTRAL_CONFIDENCE')

    for (const q of attempt.questions) {
      const correct = q.selectedAnswer !== null && q.selectedAnswer === q.correctAnswer
      const response = em.create(QuizResponse, {
        userCertification: attempt.userCertification,
        answer: q.selectedAnswer ?? '',
        correct,
        confidence: neutralConfidence,
        timeTakenMs: 0,
        questionSnapshot: {
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          provenance: q.provenance,
        },
        format: 'multiple_choice',
      })
      em.persist(response)
    }

    await em.flush()

    await this.weakAreas.recompute(attempt.userCertification.id)
    return true
  }

  async saveAnswer(
    userId: string,
    attemptId: string,
    questionIndex: number,
    answer: string,
  ): Promise<MockExamResponse> {
    const em = this.em.fork()

    const attempt = await this.findOwnedAttempt(em, userId, attemptId)

    const isTerminal = attempt.status !== 'in_progress'
    const isPastDeadline = attempt.deadline !== null && new Date() > attempt.deadline

    if (isTerminal || isPastDeadline) {
      throw new ConflictException('Attempt is no longer accepting answers')
    }

    const question = attempt.questions[questionIndex]
    if (question === undefined) {
      throw new NotFoundException('Question not found')
    }

    question.selectedAnswer = answer
    await em.flush()

    return mapMockExamToResponse(attempt)
  }

  private async findOwnedAttempt(
    em: EntityManager,
    userId: string,
    attemptId: string,
  ): Promise<MockExam> {
    const attempt = await em.findOne(MockExam, { id: attemptId, user: userId })
    if (attempt === null) {
      throw new NotFoundException('Mock exam not found')
    }
    return attempt
  }
}

function deriveGeneration(attempt: MockExam): MockExamGeneration {
  return attempt.startedAt !== null ? 'ready' : 'preparing'
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
