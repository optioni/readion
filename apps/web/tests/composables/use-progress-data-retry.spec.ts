import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { describe, expect, it, vi } from 'vitest'
import { computed, ref, type ShallowRef, shallowRef } from 'vue'
import { useProgressData } from '~/composables/useProgressData'
import { useSuppressedDomains } from '~/composables/useSuppressedDomains'

vi.mock('@tanstack/vue-query', () => ({
  useQuery: vi.fn(),
  useQueryClient: vi.fn(),
}))

vi.mock('~/composables/useSuppressedDomains', () => ({
  useSuppressedDomains: vi.fn(),
}))

interface QueryStub<T> {
  data: ShallowRef<T>
  error: ShallowRef<Error | null>
  isLoading: ShallowRef<boolean>
  isError: ShallowRef<boolean>
  isFetching: ShallowRef<boolean>
  refetch: ReturnType<typeof vi.fn>
}

function queryStub<T>(data: T): QueryStub<T> {
  return {
    data: shallowRef(data),
    error: shallowRef(null),
    isLoading: shallowRef(false),
    isError: shallowRef(false),
    isFetching: shallowRef(false),
    refetch: vi.fn().mockResolvedValue(undefined),
  }
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve = () => {}
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('useProgressData section retries', () => {
  it('refetches only failed dependencies and preserves successful region content', async () => {
    const enrollment = queryStub({
      data: { id: 'enr-1', certificationId: 'cert-1' },
      relationships: {},
    })
    const certification = queryStub({
      data: {
        id: 'cert-1',
        name: 'AWS Solutions Architect',
        provider: 'AWS',
        domains: [{ name: 'Security', weight: 100 }],
      },
      relationships: {},
    })
    const readiness = queryStub({
      calibrated: true,
      score: 66,
      trajectory: null,
    })
    const weakAreas = queryStub({
      data: [
        {
          id: 'weak-1',
          domain: 'Security',
          score: 41,
          accuracy: 41,
          meanConfidence: 0.5,
          responseCount: 10,
        },
      ],
      meta: { total: 1, page: 1, limit: 20 },
    })
    const sessions = queryStub({
      sessions: [
        {
          id: 'session-1',
          userCertificationId: 'enr-1',
          kind: 'study',
          status: 'completed',
          durationMinutes: 30,
          startedAt: '2026-06-01T09:00:00.000Z',
        },
      ],
      summariesMap: new Map(),
    })
    const mockExams = queryStub({
      data: [
        {
          id: 'exam-1',
          userCertificationId: 'enr-1',
          type: 'mock',
          status: 'completed',
          questions: [],
          startedAt: '2026-06-02T09:00:00.000Z',
          score: 80,
        },
      ],
      meta: { total: 1, page: 1, limit: 20 },
    })
    const enrollments = queryStub([])

    vi.mocked(useQuery)
      .mockReturnValueOnce(enrollment as never)
      .mockReturnValueOnce(certification as never)
      .mockReturnValueOnce(readiness as never)
      .mockReturnValueOnce(weakAreas as never)
      .mockReturnValueOnce(sessions as never)
      .mockReturnValueOnce(mockExams as never)
      .mockReturnValueOnce(enrollments as never)
    vi.mocked(useQueryClient).mockReturnValue({ fetchQuery: vi.fn() } as never)
    vi.mocked(useSuppressedDomains).mockReturnValue({
      suppressedDomains: computed(() => []),
      isLoading: ref(false),
      isError: ref(false),
    })

    const result = useProgressData('enr-1')

    readiness.isError.value = true
    const trendRetry = deferred()
    readiness.refetch.mockReturnValueOnce(trendRetry.promise)
    const retryingTrend = result.retryTrend()

    expect(readiness.refetch).toHaveBeenCalledTimes(1)
    expect(enrollment.refetch).not.toHaveBeenCalled()
    expect(sessions.refetch).not.toHaveBeenCalled()
    expect(result.trend.value.points.at(-1)?.score).toBe(66)

    trendRetry.resolve()
    await retryingTrend
    expect(sessions.refetch).not.toHaveBeenCalled()
    readiness.isError.value = false

    weakAreas.isError.value = true
    const domainsRetry = deferred()
    weakAreas.refetch.mockReturnValueOnce(domainsRetry.promise)
    const retryingDomains = result.retryDomains()

    expect(weakAreas.refetch).toHaveBeenCalledTimes(1)
    expect(certification.refetch).not.toHaveBeenCalled()
    expect(result.domainScores.value).toEqual([
      expect.objectContaining({ domain: 'Security', score: 41 }),
    ])

    domainsRetry.resolve()
    await retryingDomains
    expect(certification.refetch).not.toHaveBeenCalled()
    weakAreas.isError.value = false

    mockExams.isError.value = true
    const historyRetry = deferred()
    mockExams.refetch.mockReturnValueOnce(historyRetry.promise)
    const retryingHistory = result.retryHistory()

    expect(mockExams.refetch).toHaveBeenCalledTimes(1)
    expect(sessions.refetch).not.toHaveBeenCalled()
    expect(result.historyRows.value).toEqual([
      expect.objectContaining({ id: 'exam-1', score: 80 }),
      expect.objectContaining({ id: 'session-1' }),
    ])

    historyRetry.resolve()
    await retryingHistory
    expect(sessions.refetch).not.toHaveBeenCalled()
  })
})
