import type {
  ReviewItemResponse,
  ReviewQueueMeta,
  StartReviewResponse,
  SuppressDomainRequest,
  SuppressDomainResponse,
} from '@readion/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchCertificationDetail,
  fetchEnrollmentDetail,
  fetchEnrollmentMockExams,
  fetchEnrollments,
  fetchReadiness,
  fetchReviewQueue,
  fetchSessions,
  fetchWeakAreas,
  masterReviewItem,
  startReview,
  suppressDomain,
} from '~/composables/progressApi'
import { certificationsControllerDetail } from '~~/src/api/certifications/certifications'
import { enrollmentMockExamControllerList } from '~~/src/api/enrollment-mock-exam/enrollment-mock-exam'
import {
  enrollmentReviewControllerQueue,
  enrollmentReviewControllerStart,
  enrollmentReviewControllerSuppressDomain,
} from '~~/src/api/enrollment-review/enrollment-review'
import type {
  CertificationDetailResponseDto,
  EnrollmentDetailResponseDto,
  EnrollmentListResponseDto,
  MockExamListResponseDto,
  ReadinessResponseDto,
  SessionListResponseDto,
  WeakAreaListResponseDto,
} from '~~/src/api/model'
import { readinessControllerRead } from '~~/src/api/readiness/readiness'
import { reviewItemsControllerMaster } from '~~/src/api/review-items/review-items'
import { sessionsControllerList } from '~~/src/api/sessions/sessions'
import {
  userCertificationsControllerDetail,
  userCertificationsControllerList,
  userCertificationsControllerListWeakAreas,
} from '~~/src/api/user-certifications/user-certifications'

vi.mock('~~/src/api/readiness/readiness', () => ({
  readinessControllerRead: vi.fn(),
}))
vi.mock('~~/src/api/user-certifications/user-certifications', () => ({
  userCertificationsControllerList: vi.fn(),
  userCertificationsControllerDetail: vi.fn(),
  userCertificationsControllerListWeakAreas: vi.fn(),
}))
vi.mock('~~/src/api/certifications/certifications', () => ({
  certificationsControllerDetail: vi.fn(),
}))
vi.mock('~~/src/api/sessions/sessions', () => ({
  sessionsControllerList: vi.fn(),
}))
vi.mock('~~/src/api/enrollment-mock-exam/enrollment-mock-exam', () => ({
  enrollmentMockExamControllerList: vi.fn(),
}))
vi.mock('~~/src/api/enrollment-review/enrollment-review', () => ({
  enrollmentReviewControllerQueue: vi.fn(),
  enrollmentReviewControllerStart: vi.fn(),
  enrollmentReviewControllerSuppressDomain: vi.fn(),
}))
vi.mock('~~/src/api/review-items/review-items', () => ({
  reviewItemsControllerMaster: vi.fn(),
}))

// biome-ignore lint/suspicious/noExplicitAny: test fixtures are narrowed to the fields under assertion
const ok = (data: unknown, status = 200): any => ({ data, status, headers: new Headers() })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fetchReadiness', () => {
  it('GETs readiness and returns the inner ReadinessResponseDto', async () => {
    const readiness: ReadinessResponseDto = { calibrated: true, score: 72, trajectory: null }
    vi.mocked(readinessControllerRead).mockResolvedValue(ok({ data: readiness }))

    const result = await fetchReadiness('e-1')

    expect(readinessControllerRead).toHaveBeenCalledWith('e-1')
    expect(result).toEqual(readiness)
  })
})

describe('fetchWeakAreas', () => {
  it('GETs weak areas and returns the WeakAreaListResponseDto', async () => {
    const dto: WeakAreaListResponseDto = {
      data: [],
      meta: { total: 0 },
    }
    vi.mocked(userCertificationsControllerListWeakAreas).mockResolvedValue(ok(dto))

    const result = await fetchWeakAreas('e-1')

    expect(userCertificationsControllerListWeakAreas).toHaveBeenCalledWith('e-1')
    expect(result).toEqual(dto)
  })
})

describe('fetchCertificationDetail', () => {
  it('GETs certification detail and returns the CertificationDetailResponseDto', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: fixture narrowed to the field under assertion
    const dto = { data: { id: 'c-1', name: 'AWS SAA' } } as any as CertificationDetailResponseDto
    vi.mocked(certificationsControllerDetail).mockResolvedValue(ok(dto))

    const result = await fetchCertificationDetail('c-1')

    expect(certificationsControllerDetail).toHaveBeenCalledWith('c-1')
    expect(result).toEqual(dto)
  })
})

describe('fetchEnrollments', () => {
  it('GETs the enrollment list and returns the EnrollmentListResponseDto', async () => {
    const dto: EnrollmentListResponseDto = {
      data: [],
      meta: { total: 0, page: 1, limit: 20 },
    }
    vi.mocked(userCertificationsControllerList).mockResolvedValue(ok(dto))

    const result = await fetchEnrollments()

    expect(userCertificationsControllerList).toHaveBeenCalledWith()
    expect(result).toEqual(dto)
  })
})

describe('fetchEnrollmentDetail', () => {
  it('GETs enrollment detail and returns the EnrollmentDetailResponseDto', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: fixture narrowed to the field under assertion
    const dto = { data: { id: 'e-1' }, relationships: {} } as any as EnrollmentDetailResponseDto
    vi.mocked(userCertificationsControllerDetail).mockResolvedValue(ok(dto))

    const result = await fetchEnrollmentDetail('e-1')

    expect(userCertificationsControllerDetail).toHaveBeenCalledWith('e-1')
    expect(result).toEqual(dto)
  })
})

describe('fetchSessions', () => {
  it('GETs sessions with params and returns the SessionListResponseDto', async () => {
    const dto: SessionListResponseDto = {
      data: [],
      meta: { total: 0, page: 1, limit: 20 },
    }
    vi.mocked(sessionsControllerList).mockResolvedValue(ok(dto))

    const params = { certificationId: 'c-1', page: 1, limit: 20 }
    const result = await fetchSessions(params)

    expect(sessionsControllerList).toHaveBeenCalledWith(params)
    expect(result).toEqual(dto)
  })
})

describe('fetchEnrollmentMockExams', () => {
  it('GETs mock exams and returns MockExamListResponseDto on 200', async () => {
    const dto: MockExamListResponseDto = {
      data: [],
      meta: { total: 0, page: 1, limit: 20 },
    }
    vi.mocked(enrollmentMockExamControllerList).mockResolvedValue(ok(dto, 200))

    const result = await fetchEnrollmentMockExams('e-1')

    expect(enrollmentMockExamControllerList).toHaveBeenCalledWith('e-1')
    expect(result).toEqual(dto)
  })

  it('returns an empty list on a 404 response', async () => {
    vi.mocked(enrollmentMockExamControllerList).mockResolvedValue(ok(undefined, 404))

    const result = await fetchEnrollmentMockExams('e-1')

    expect(result.data).toEqual([])
  })
})

describe('fetchReviewQueue', () => {
  it('GETs the review queue and unwraps the envelope', async () => {
    const items: ReviewItemResponse[] = [
      {
        id: 'ri-1',
        userCertificationId: 'e-1',
        anchorChunkId: 'c-1',
        domain: 'IAM',
        box: 1,
        state: 'active',
        dueAt: '2026-06-29T00:00:00Z',
        lastReviewedAt: null,
      },
    ]
    const meta: ReviewQueueMeta = { dueCount: 1, total: 5 }
    vi.mocked(enrollmentReviewControllerQueue).mockResolvedValue(ok({ data: { items, meta } }))

    const result = await fetchReviewQueue('e-1')

    expect(enrollmentReviewControllerQueue).toHaveBeenCalledWith('e-1')
    expect(result.items).toEqual(items)
    expect(result.meta).toEqual(meta)
  })
})

describe('startReview', () => {
  it('POSTs to start review and unwraps a started response', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: fixture narrowed to the field under assertion
    const started: StartReviewResponse = { status: 'started', session: { id: 's-1' } as any }
    vi.mocked(enrollmentReviewControllerStart).mockResolvedValue(ok({ data: started }))

    const result = await startReview('e-1')

    expect(enrollmentReviewControllerStart).toHaveBeenCalledWith('e-1')
    expect(result.status).toBe('started')
  })

  it('unwraps an all_caught_up response', async () => {
    const caughtUp: StartReviewResponse = { status: 'all_caught_up' }
    vi.mocked(enrollmentReviewControllerStart).mockResolvedValue(ok({ data: caughtUp }))

    const result = await startReview('e-1')

    expect(result.status).toBe('all_caught_up')
  })
})

describe('suppressDomain', () => {
  it('POSTs suppress-domain with the body and unwraps the response', async () => {
    const body: SuppressDomainRequest = { domain: 'IAM' }
    const response: SuppressDomainResponse = { suppressedCount: 3 }
    vi.mocked(enrollmentReviewControllerSuppressDomain).mockResolvedValue(ok({ data: response }))

    const result = await suppressDomain('e-1', body)

    expect(enrollmentReviewControllerSuppressDomain).toHaveBeenCalledWith('e-1', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    expect(result.suppressedCount).toBe(3)
  })
})

describe('masterReviewItem', () => {
  it('POSTs to master a review item', async () => {
    vi.mocked(reviewItemsControllerMaster).mockResolvedValue(ok(undefined))

    await masterReviewItem('ri-1')

    expect(reviewItemsControllerMaster).toHaveBeenCalledWith('ri-1')
  })
})
