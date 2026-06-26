import { EntityManager } from '@mikro-orm/core'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ContentChunk, MockExam, QuizResponse, StudySession, UserCertification } from '@readion/db'
import {
  type DrillResultResponse,
  READINESS_CALIBRATION_MIN_ANSWERS_DEFAULT,
  type SessionSummaryResponse,
  SUMMARY_DRILL_MAX_QUESTIONS,
  SUMMARY_UNSURE_CONFIDENCE_THRESHOLD,
} from '@readion/shared'
import type { EnvConfig } from '../config/env.schema'
import { SessionsService } from '../sessions/sessions.service'
import { WeakAreasService } from '../weak-areas/weak-areas.service'
import { summarizeResponses } from './accuracy-rollup'
import { computeDeltas, type DeltaInput, type MockResultInput } from './delta-calculator'
import {
  type MockQuestionTarget,
  type SessionResponseTarget,
  selectDrillTargets,
} from './drill-targets'
import type { ResponseWithDomain } from './response-domain-mapper'
import { type GradedResponse, selectNextFocus, selectStrongest, selectWeakest } from './selectors'

const MOCK_NEUTRAL_CONFIDENCE = 3

type DomainedResponse = {
  id: string
  question: string
  correct: boolean
  confidence: number
  timeTakenMs: number
  createdAt: Date
  domain: string
  anchorChunkId?: string
}

@Injectable()
export class SessionSummaryService {
  constructor(
    private readonly em: EntityManager,
    private readonly sessions: SessionsService,
    private readonly weakAreas: WeakAreasService,
    private readonly config: ConfigService<EnvConfig>,
  ) {}

  async getSessionSummary(userId: string, sessionId: string): Promise<SessionSummaryResponse> {
    const em = this.em.fork()
    const session = await this.loadSession(em, userId, sessionId)
    if (session.status === 'active') {
      throw new ConflictException('Session is still active')
    }

    const enrollmentId = session.userCertification.id
    const { before, inWindow } = await this.loadWindowedResponses(
      em,
      enrollmentId,
      session.startedAt,
      session.endedAt,
    )

    const beforeDomained = await this.attachDomains(em, before)
    const inWindowDomained = await this.attachDomains(em, inWindow)
    const afterDomained = [...beforeDomained, ...inWindowDomained]

    const mockResults = await this.loadMockResults(em, enrollmentId)
    const hasCompletedDiagnostic = await this.hasCompletedDiagnostic(em, enrollmentId)

    return this.composeSummary(userId, enrollmentId, {
      activityResponses: inWindowDomained,
      beforeResponses: beforeDomained,
      afterResponses: afterDomained,
      mockResultsBefore: mockResults,
      mockResultsAfter: mockResults,
      hasCompletedDiagnostic,
    })
  }

  async getMockSummary(userId: string, mockId: string): Promise<SessionSummaryResponse> {
    const em = this.em.fork()
    const mock = await this.loadMock(em, userId, mockId)
    if (mock.status === 'in_progress') {
      throw new ConflictException('Mock exam is still in progress')
    }

    const enrollmentId = mock.userCertification.id
    const boundary = mock.updatedAt

    const activityResponses: DomainedResponse[] = mock.questions.map((q) => ({
      id: q.id,
      question: q.question,
      correct: q.selectedAnswer === q.correctAnswer,
      confidence: MOCK_NEUTRAL_CONFIDENCE,
      timeTakenMs: 0,
      createdAt: boundary,
      domain: q.domain,
    }))

    const priorResponses = await em.find(
      QuizResponse,
      { userCertification: enrollmentId, createdAt: { $lt: boundary } },
      { orderBy: { createdAt: 'ASC' } },
    )
    const beforeResponses = await this.attachDomains(em, priorResponses)
    const afterResponses = [...beforeResponses, ...activityResponses]

    const mockResultsBefore = await this.loadMockResults(em, enrollmentId, mockId)
    const mockResultsAfter =
      mock.score !== null
        ? [...mockResultsBefore, { score: mock.score, at: boundary }]
        : mockResultsBefore
    const hasCompletedDiagnostic = await this.hasCompletedDiagnostic(em, enrollmentId)

    return this.composeSummary(userId, enrollmentId, {
      activityResponses,
      beforeResponses,
      afterResponses,
      mockResultsBefore,
      mockResultsAfter,
      hasCompletedDiagnostic,
    })
  }

  async drillSession(userId: string, sessionId: string): Promise<DrillResultResponse> {
    const em = this.em.fork()
    const session = await this.loadSession(em, userId, sessionId)
    const enrollmentId = session.userCertification.id

    const { inWindow } = await this.loadWindowedResponses(
      em,
      enrollmentId,
      session.startedAt,
      session.endedAt,
    )
    const domained = await this.attachDomains(em, inWindow)

    const targets: SessionResponseTarget[] = domained
      .filter(
        (r): r is DomainedResponse & { anchorChunkId: string } => r.anchorChunkId !== undefined,
      )
      .map((r) => ({
        correct: r.correct,
        confidence: r.confidence,
        domain: r.domain,
        anchorChunkId: r.anchorChunkId,
      }))

    return this.runDrill(userId, enrollmentId, targets, 'session')
  }

  async drillMock(userId: string, mockId: string): Promise<DrillResultResponse> {
    const em = this.em.fork()
    const mock = await this.loadMock(em, userId, mockId)
    const enrollmentId = mock.userCertification.id

    const targets: MockQuestionTarget[] = mock.questions
      .map((q) => {
        const anchorChunkId = q.provenance.sourceChunkIds[0]
        if (anchorChunkId === undefined) return null
        return {
          selectedAnswer: q.selectedAnswer,
          correctAnswer: q.correctAnswer,
          domain: q.domain,
          anchorChunkId,
        }
      })
      .filter((t): t is MockQuestionTarget => t !== null)

    return this.runDrill(userId, enrollmentId, targets, 'mock')
  }

  private async runDrill(
    userId: string,
    enrollmentId: string,
    targets: (SessionResponseTarget | MockQuestionTarget)[],
    type: 'session' | 'mock',
  ): Promise<DrillResultResponse> {
    const reviewTargets = selectDrillTargets(targets, type, {
      unsureThreshold: this.unsureThreshold(),
      maxTargets: this.maxDrillTargets(),
    })

    if (reviewTargets.length === 0) {
      return { status: 'no_misses' }
    }

    const { session } = await this.sessions.createReviewSession(userId, enrollmentId, reviewTargets)
    return { status: 'started', session }
  }

  private async composeSummary(
    userId: string,
    enrollmentId: string,
    params: {
      activityResponses: DomainedResponse[]
      beforeResponses: DomainedResponse[]
      afterResponses: DomainedResponse[]
      mockResultsBefore: MockResultInput[]
      mockResultsAfter: MockResultInput[]
      hasCompletedDiagnostic: boolean
    },
  ): Promise<SessionSummaryResponse> {
    const rollupInputs: ResponseWithDomain[] = params.activityResponses.map((r) => ({
      correct: r.correct,
      confidence: r.confidence,
      primaryDomain: r.domain,
    }))
    const rollup = summarizeResponses(rollupInputs)

    const domainWeights = await this.loadDomainWeights(enrollmentId)
    const deltas = computeDeltas({
      beforeResponses: params.beforeResponses.map(toDeltaInput),
      afterResponses: params.afterResponses.map(toDeltaInput),
      domainWeights,
      mockResultsBefore: params.mockResultsBefore,
      mockResultsAfter: params.mockResultsAfter,
      calibrationThreshold: this.calibrationThreshold(),
      hasCompletedDiagnostic: params.hasCompletedDiagnostic,
      now: new Date(),
    })

    const graded: GradedResponse[] = params.activityResponses.map((r) => ({
      responseId: r.id,
      question: r.question,
      correct: r.correct,
      confidence: r.confidence,
      timeTakenMs: r.timeTakenMs,
      createdAt: r.createdAt,
    }))

    const weakAreaList = await this.weakAreas.listForEnrollment(userId, enrollmentId)
    const nextFocus = selectNextFocus(
      weakAreaList.map((w) => ({ domain: w.domain, score: w.score })),
    )

    return {
      questionsAnswered: rollup.questionsAnswered,
      accuracy: rollup.accuracy,
      domains: rollup.domains,
      weakAreaDeltas: deltas.weakAreaDeltas,
      readiness: deltas.readiness,
      strongestQuestion: selectStrongest(graded),
      weakestQuestion: selectWeakest(graded),
      nextFocus,
    }
  }

  private async loadSession(
    em: EntityManager,
    userId: string,
    sessionId: string,
  ): Promise<StudySession> {
    const session = await em.findOne(
      StudySession,
      { id: sessionId, user: userId },
      { populate: ['userCertification', 'userCertification.certification'] },
    )
    if (session === null) {
      throw new NotFoundException('Session not found')
    }
    return session
  }

  private async loadMock(em: EntityManager, userId: string, mockId: string): Promise<MockExam> {
    const mock = await em.findOne(
      MockExam,
      { id: mockId, user: userId },
      { populate: ['userCertification', 'userCertification.certification'] },
    )
    if (mock === null) {
      throw new NotFoundException('Mock exam not found')
    }
    return mock
  }

  private async loadWindowedResponses(
    em: EntityManager,
    enrollmentId: string,
    startedAt: Date,
    endedAt: Date | null,
  ): Promise<{ before: QuizResponse[]; inWindow: QuizResponse[] }> {
    const responses = await em.find(
      QuizResponse,
      { userCertification: enrollmentId },
      { orderBy: { createdAt: 'ASC' } },
    )

    const before: QuizResponse[] = []
    const inWindow: QuizResponse[] = []
    for (const r of responses) {
      if (r.createdAt < startedAt) {
        before.push(r)
      } else if (endedAt === null || r.createdAt <= endedAt) {
        inWindow.push(r)
      }
    }
    return { before, inWindow }
  }

  private async attachDomains(
    em: EntityManager,
    responses: QuizResponse[],
  ): Promise<DomainedResponse[]> {
    const chunkIds = [
      ...new Set(responses.flatMap((r) => r.questionSnapshot.provenance.sourceChunkIds)),
    ]
    const chunks = chunkIds.length > 0 ? await em.find(ContentChunk, { id: { $in: chunkIds } }) : []
    const chunkDomainMap = new Map(chunks.map((c) => [c.id, c.primaryDomain]))

    const result: DomainedResponse[] = []
    for (const r of responses) {
      const sourceChunkIds = r.questionSnapshot.provenance.sourceChunkIds
      const domain = sourceChunkIds.map((id) => chunkDomainMap.get(id)).find((d) => d !== undefined)
      const anchorChunkId = sourceChunkIds[0]
      if (domain === undefined || anchorChunkId === undefined) continue
      result.push({
        id: r.id,
        question: r.questionSnapshot.question,
        correct: r.correct,
        confidence: r.confidence,
        timeTakenMs: r.timeTakenMs,
        createdAt: r.createdAt,
        domain,
        anchorChunkId,
      })
    }
    return result
  }

  private async loadMockResults(
    em: EntityManager,
    enrollmentId: string,
    excludeMockId?: string,
  ): Promise<MockResultInput[]> {
    const mocks = await em.find(MockExam, {
      userCertification: enrollmentId,
      type: 'mock',
      status: { $in: ['submitted', 'expired'] },
    })
    return mocks
      .filter((m) => m.score !== null && m.id !== excludeMockId)
      .map((m) => ({ score: m.score as number, at: m.updatedAt }))
  }

  private async hasCompletedDiagnostic(em: EntityManager, enrollmentId: string): Promise<boolean> {
    const diagnostic = await em.findOne(MockExam, {
      userCertification: enrollmentId,
      type: 'diagnostic',
      status: 'submitted',
    })
    return diagnostic !== null
  }

  private async loadDomainWeights(
    enrollmentId: string,
  ): Promise<{ domain: string; weight: number }[]> {
    const em = this.em.fork()
    const enrollment = await em.findOne(
      UserCertification,
      { id: enrollmentId },
      { populate: ['certification'] },
    )
    return (
      enrollment?.certification.domains.map((d) => ({ domain: d.name, weight: d.weight })) ?? []
    )
  }

  private unsureThreshold(): number {
    return (
      this.config.get('SUMMARY_UNSURE_CONFIDENCE_THRESHOLD', { infer: true }) ??
      SUMMARY_UNSURE_CONFIDENCE_THRESHOLD
    )
  }

  private maxDrillTargets(): number {
    return (
      this.config.get('SUMMARY_DRILL_MAX_QUESTIONS', { infer: true }) ?? SUMMARY_DRILL_MAX_QUESTIONS
    )
  }

  private calibrationThreshold(): number {
    return (
      this.config.get('READINESS_CALIBRATION_MIN_ANSWERS', { infer: true }) ??
      READINESS_CALIBRATION_MIN_ANSWERS_DEFAULT
    )
  }
}

function toDeltaInput(r: DomainedResponse): DeltaInput {
  return { domain: r.domain, correct: r.correct, confidence: r.confidence, createdAt: r.createdAt }
}
