import { EntityManager } from '@mikro-orm/core'
import { Injectable, NotFoundException } from '@nestjs/common'
import { ContentChunk, MockExam, QuizResponse, UserCertification } from '@readion/db'
import { isCalibrated } from '../readiness/calibration'
import {
  computeReadiness,
  type ReadinessDomainSignal,
  type ReadinessDomainWeight,
  type ReadinessMockResult,
} from '../readiness/readiness.calculator'
import type { DomainScoreInput } from '../weak-areas/domain-scoring'
import { computeDomainScore } from '../weak-areas/domain-scoring'

export type AsOfReadinessResult =
  | { calibrated: true; score: number }
  | { calibrated: false; score: null }

const NOT_CALIBRATED: AsOfReadinessResult = { calibrated: false, score: null }

// Derives an enrollment's readiness AS OF a past instant by replaying the immutable, timestamped
// quiz-response and mock-exam rows that existed at that instant through the very same building
// blocks the live ReadinessService uses (domain scoring → calibration → readiness calculator).
//
// This is deliberately isolated from ReadinessService: that service computes CURRENT readiness
// only and must not learn an as-of contract. Should a readiness-snapshot entity ever exist, this
// class is the single seam to replace — callers depend on `computeAt`, not on the replay itself.
@Injectable()
export class AsOfReadiness {
  constructor(private readonly em: EntityManager) {}

  async computeAt(
    userCertificationId: string,
    asOf: Date,
    threshold: number,
  ): Promise<AsOfReadinessResult> {
    const em = this.em.fork()
    const enrollment = await em.findOne(
      UserCertification,
      { id: userCertificationId },
      { populate: ['certification'] },
    )
    if (enrollment === null) {
      throw new NotFoundException('Enrollment not found')
    }

    const responses = await em.find(QuizResponse, {
      userCertification: userCertificationId,
      createdAt: { $lte: asOf },
    })

    const chunkDomainMap = await this.resolveChunkDomains(em, responses)
    const { perDomainScores, gradedAnswerCount } = this.aggregateDomains(responses, chunkDomainMap)

    const mocks = await em.find(MockExam, {
      userCertification: userCertificationId,
      status: { $in: ['submitted', 'expired'] },
      updatedAt: { $lte: asOf },
    })
    const hasCompletedDiagnostic = mocks.some(
      (m) => m.type === 'diagnostic' && m.status === 'submitted',
    )

    if (!isCalibrated({ gradedAnswerCount, hasCompletedDiagnostic, threshold })) {
      return NOT_CALIBRATED
    }

    const domainWeights: ReadinessDomainWeight[] = enrollment.certification.domains.map((d) => ({
      domain: d.name,
      weight: d.weight,
    }))
    const mockResults: ReadinessMockResult[] = mocks
      .filter((m) => m.score !== null && m.type === 'mock')
      .map((m) => ({ score: m.score as number, at: m.updatedAt }))

    const score = computeReadiness({ perDomainScores, domainWeights, mockResults, now: asOf })
    return { calibrated: true, score }
  }

  private async resolveChunkDomains(
    em: EntityManager,
    responses: QuizResponse[],
  ): Promise<Map<string, string>> {
    const allChunkIds = [
      ...new Set(responses.flatMap((r) => r.questionSnapshot.provenance.sourceChunkIds)),
    ]
    const chunks =
      allChunkIds.length > 0 ? await em.find(ContentChunk, { id: { $in: allChunkIds } }) : []
    return new Map(chunks.map((c) => [c.id, c.primaryDomain]))
  }

  private aggregateDomains(
    responses: QuizResponse[],
    chunkDomainMap: Map<string, string>,
  ): { perDomainScores: ReadinessDomainSignal[]; gradedAnswerCount: number } {
    const domainInputs = new Map<string, DomainScoreInput[]>()
    const domainLastActivity = new Map<string, Date>()
    for (const response of responses) {
      // Attribution uses the first resolvable chunk's primaryDomain, mirroring WeakAreasService.
      const domain = response.questionSnapshot.provenance.sourceChunkIds
        .map((id) => chunkDomainMap.get(id))
        .find((d) => d !== undefined)
      if (domain === undefined) {
        continue
      }
      const inputs = domainInputs.get(domain) ?? []
      inputs.push({ correct: response.correct, confidence: response.confidence })
      domainInputs.set(domain, inputs)
      const previous = domainLastActivity.get(domain)
      if (previous === undefined || response.createdAt > previous) {
        domainLastActivity.set(domain, response.createdAt)
      }
    }

    const perDomainScores: ReadinessDomainSignal[] = []
    let gradedAnswerCount = 0
    for (const [domain, inputs] of domainInputs) {
      const computed = computeDomainScore(inputs)
      gradedAnswerCount += computed.responseCount
      // Recency decay keys off the most-recent attributed response ≤ T per domain, a faithful
      // as-of proxy for the weak-area updatedAt the live service relies on.
      perDomainScores.push({
        domain,
        score: computed.score,
        lastActivityAt: domainLastActivity.get(domain) as Date,
      })
    }

    return { perDomainScores, gradedAnswerCount }
  }
}
