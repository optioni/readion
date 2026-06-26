import { EntityManager } from '@mikro-orm/core'
import { Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { MockExam, UserCertification, WeakArea } from '@readion/db'
import { READINESS_CALIBRATION_MIN_ANSWERS_DEFAULT } from '@readion/shared'
import type { EnvConfig } from '../config/env.schema'
import { WeakAreasService } from '../weak-areas/weak-areas.service'
import type { ReadinessResult } from './calibration'
import { isCalibrated } from './calibration'
import {
  computeReadiness,
  type ReadinessDomainSignal,
  type ReadinessDomainWeight,
  type ReadinessMockResult,
} from './readiness.calculator'
import { estimateTrajectory, type ReadinessHistoryPoint } from './trajectory'

const NOT_CALIBRATED: ReadinessResult = { calibrated: false, score: null, trajectory: null }

@Injectable()
export class ReadinessService {
  constructor(
    private readonly em: EntityManager,
    private readonly config: ConfigService<EnvConfig>,
    private readonly weakAreas: WeakAreasService,
  ) {}

  async readForOwner(userId: string, userCertificationId: string): Promise<ReadinessResult> {
    const em = this.em.fork()
    const enrollment = await em.findOne(UserCertification, {
      id: userCertificationId,
      user: userId,
    })
    if (enrollment === null) {
      throw new NotFoundException('Enrollment not found')
    }

    return this.compute(userCertificationId)
  }

  async compute(userCertificationId: string): Promise<ReadinessResult> {
    await this.weakAreas.recompute(userCertificationId)

    const em = this.em.fork()
    const enrollment = await em.findOne(
      UserCertification,
      { id: userCertificationId },
      { populate: ['certification'] },
    )
    if (enrollment === null) {
      throw new NotFoundException('Enrollment not found')
    }

    const weakAreas = await em.find(WeakArea, { userCertification: userCertificationId })
    const mocks = await em.find(MockExam, {
      userCertification: userCertificationId,
      status: { $in: ['submitted', 'expired'] },
    })

    const gradedAnswerCount = weakAreas.reduce((sum, w) => sum + w.responseCount, 0)
    const hasCompletedDiagnostic = mocks.some(
      (m) => m.type === 'diagnostic' && m.status === 'submitted',
    )
    const threshold =
      this.config.get('READINESS_CALIBRATION_MIN_ANSWERS', { infer: true }) ??
      READINESS_CALIBRATION_MIN_ANSWERS_DEFAULT

    if (!isCalibrated({ gradedAnswerCount, hasCompletedDiagnostic, threshold })) {
      return NOT_CALIBRATED
    }

    const domainWeights: ReadinessDomainWeight[] = enrollment.certification.domains.map((d) => ({
      domain: d.name,
      weight: d.weight,
    }))
    const perDomainScores: ReadinessDomainSignal[] = weakAreas.map((w) => ({
      domain: w.domain,
      score: w.score,
      lastActivityAt: w.updatedAt,
    }))
    const mockResults: ReadinessMockResult[] = mocks
      .filter((m) => m.score !== null)
      .map((m) => ({ score: m.score as number, at: m.updatedAt }))

    const now = new Date()
    const score = computeReadiness({ perDomainScores, domainWeights, mockResults, now })
    const trajectory = estimateTrajectory(
      this.buildHistory(perDomainScores, domainWeights, mockResults),
    )

    return { calibrated: true, score, trajectory }
  }

  // Point-in-time readiness over the response/mock timeline, since there is no
  // readiness snapshot store. Each distinct activity timestamp yields a sample
  // computed from the signal available up to that moment.
  private buildHistory(
    perDomainScores: ReadinessDomainSignal[],
    domainWeights: ReadinessDomainWeight[],
    mockResults: ReadinessMockResult[],
  ): ReadinessHistoryPoint[] {
    const timestamps = [
      ...perDomainScores.map((s) => s.lastActivityAt.getTime()),
      ...mockResults.map((m) => m.at.getTime()),
    ]
    const distinct = [...new Set(timestamps)].sort((a, b) => a - b)

    return distinct.map((ms) => {
      const now = new Date(ms)
      const score = computeReadiness({
        perDomainScores: perDomainScores.filter((s) => s.lastActivityAt.getTime() <= ms),
        domainWeights,
        mockResults: mockResults.filter((m) => m.at.getTime() <= ms),
        now,
      })
      return { at: now, score }
    })
  }
}
