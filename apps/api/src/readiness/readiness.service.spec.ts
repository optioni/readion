import { EntityManager } from '@mikro-orm/core'
import { ConfigService } from '@nestjs/config'
import { MockExam, UserCertification, WeakArea } from '@readion/db'
import { describe, expect, it, vi } from 'vitest'
import type { EnvConfig } from '../config/env.schema'
import { WeakAreasService } from '../weak-areas/weak-areas.service'
import { ReadinessService } from './readiness.service'

const NOW = new Date('2026-06-26T12:00:00.000Z')
const ENROLLMENT_ID = 'enrollment-1'

function stubWeakArea(domain: string, score: number, responseCount: number): WeakArea {
  return { domain, score, responseCount, updatedAt: NOW } as unknown as WeakArea
}

function stubMockExam(type: 'mock' | 'diagnostic', score: number): MockExam {
  return { type, status: 'submitted', score, updatedAt: NOW } as unknown as MockExam
}

function stubEnrollment(): UserCertification {
  return {
    id: ENROLLMENT_ID,
    certification: { domains: [{ name: 'Cloud Concepts', weight: 100 }] },
  } as unknown as UserCertification
}

function makeService(weakAreas: WeakArea[], mocks: MockExam[]): ReadinessService {
  const em = {
    fork: vi.fn(),
    findOne: vi.fn().mockResolvedValue(stubEnrollment()),
    find: vi.fn().mockImplementation((Entity: unknown) => {
      if (Entity === WeakArea) return Promise.resolve(weakAreas)
      if (Entity === MockExam) return Promise.resolve(mocks)
      return Promise.resolve([])
    }),
  }
  em.fork.mockReturnValue(em)

  const config = {
    get: vi.fn().mockReturnValue(undefined),
  } as unknown as ConfigService<EnvConfig>

  const weakAreasService = {
    recompute: vi.fn().mockResolvedValue(undefined),
  } as unknown as WeakAreasService

  return new ReadinessService(
    em as unknown as EntityManager,
    config,
    weakAreasService,
  )
}

describe('ReadinessService — diagnostic weight exclusion', () => {
  it('does not include a submitted diagnostic in the mock blend while still calibrating via hasCompletedDiagnostic', async () => {
    const weakAreas = [stubWeakArea('Cloud Concepts', 60, 5)]
    // Diagnostic with a perfect score — if wrongly included in the mock blend this inflates the score
    const mocks = [stubMockExam('diagnostic', 100)]

    const result = await makeService(weakAreas, mocks).compute(ENROLLMENT_ID)

    // Diagnostic must still satisfy the calibration gate
    expect(result.calibrated).toBe(true)

    if (!result.calibrated) return

    // Including a diagnostic (score=100) in the mock blend with quiz score ~60 always yields ≥ 83.
    // Correctly excluding it keeps the score in the quiz-only range (≤ 60).
    // The threshold 75 sits safely between these two ranges.
    expect(result.score).toBeLessThan(75)
  })
})
