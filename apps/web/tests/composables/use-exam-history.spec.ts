import { afterEach, describe, expect, it, vi } from 'vitest'
import { useExamHistory } from '~/composables/useExamHistory'
import { enrollmentMockExamControllerList } from '~~/src/api/enrollment-mock-exam/enrollment-mock-exam'
import { renderComposable } from '../support/vue-query-harness'

vi.mock('~~/src/api/enrollment-mock-exam/enrollment-mock-exam')

const attempt = (overrides: Record<string, unknown> & { id: string }) => ({
  userCertificationId: 'enr-1',
  type: 'mock',
  status: 'submitted',
  generation: {},
  startedAt: '2026-06-20T09:00:00Z',
  deadline: null,
  remainingSeconds: null,
  score: 78,
  passed: true,
  domainBreakdown: {},
  questions: [{ id: 'q1' }],
  ...overrides,
})

const okEnvelope = (rows: unknown[]) => ({
  data: { data: rows, meta: { total: rows.length, page: 1, limit: 10 } },
  status: 200,
  headers: new Headers(),
})

describe('useExamHistory', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('maps each attempt to a header-only row scoped to the enrollment id', async () => {
    vi.mocked(enrollmentMockExamControllerList).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      okEnvelope([attempt({ id: 'm1' })]) as any,
    )

    const { result } = renderComposable(() => useExamHistory('enr-1'))

    await vi.waitFor(() => {
      expect(result.isLoading.value).toBe(false)
    })

    expect(enrollmentMockExamControllerList).toHaveBeenCalledWith('enr-1')
    expect(result.rows.value).toEqual([
      {
        id: 'm1',
        date: '2026-06-20T09:00:00Z',
        type: 'mock',
        status: 'submitted',
        score: 78,
        passed: true,
      },
    ])
    expect(result.rows.value[0]).not.toHaveProperty('questions')
  })

  it('narrows nullable score, passed and startedAt to null for an in-progress attempt', async () => {
    vi.mocked(enrollmentMockExamControllerList).mockResolvedValue(
      okEnvelope([
        attempt({
          id: 'm2',
          type: 'diagnostic',
          status: 'in_progress',
          startedAt: null,
          score: null,
          passed: null,
        }),
        // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      ]) as any,
    )

    const { result } = renderComposable(() => useExamHistory('enr-1'))

    await vi.waitFor(() => {
      expect(result.isLoading.value).toBe(false)
    })

    expect(result.rows.value).toEqual([
      {
        id: 'm2',
        date: null,
        type: 'diagnostic',
        status: 'in_progress',
        score: null,
        passed: null,
      },
    ])
  })

  it('exposes an empty list when there are no attempts', async () => {
    vi.mocked(enrollmentMockExamControllerList).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      okEnvelope([]) as any,
    )

    const { result } = renderComposable(() => useExamHistory('enr-1'))

    await vi.waitFor(() => {
      expect(result.isLoading.value).toBe(false)
    })

    expect(result.rows.value).toEqual([])
  })

  it('degrades to an empty list when the request fails', async () => {
    vi.mocked(enrollmentMockExamControllerList).mockRejectedValue(new Error('boom'))

    const { result } = renderComposable(() => useExamHistory('enr-1'))

    await vi.waitFor(() => {
      expect(result.isError.value).toBe(true)
    })

    expect(result.rows.value).toEqual([])
  })
})
