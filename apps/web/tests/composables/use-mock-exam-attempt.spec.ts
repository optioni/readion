import type { MockExamResponse } from '@readion/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchMockExam } from '~/composables/mockExamApi'
import { useMockExamAttempt } from '~/composables/useMockExamAttempt'
import { renderComposable } from '../support/vue-query-harness'

vi.mock('~/composables/mockExamApi', () => ({ fetchMockExam: vi.fn() }))

function exam(generation: 'preparing' | 'ready', questionCount: number): MockExamResponse {
  return {
    id: 'exam-1',
    userCertificationId: 'enr-1',
    type: 'mock',
    status: 'in_progress',
    generation,
    startedAt: generation === 'ready' ? '2026-06-29T10:00:00.000Z' : null,
    deadline: null,
    remainingSeconds: null,
    score: null,
    passed: null,
    domainBreakdown: {},
    questions: Array.from({ length: questionCount }, (_unused, index) => ({
      id: `q-${index}`,
      question: `Q${index}`,
      options: ['a', 'b', 'c', 'd'],
      domain: 'Domain',
      userAnswer: null,
    })),
  }
}

describe('useMockExamAttempt', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('polls while generation is preparing and stops once a poll returns ready', async () => {
    vi.mocked(fetchMockExam)
      .mockResolvedValueOnce(exam('preparing', 20))
      .mockResolvedValueOnce(exam('preparing', 43))
      .mockResolvedValueOnce(exam('ready', 65))
      .mockResolvedValue(exam('ready', 65))

    const { result, wrapper } = renderComposable(() => useMockExamAttempt('exam-1'))

    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMockExam).toHaveBeenCalledTimes(1)
    expect(result.exam.value?.questions.length).toBe(20)

    await vi.advanceTimersByTimeAsync(1500)
    expect(fetchMockExam).toHaveBeenCalledTimes(2)
    expect(result.exam.value?.questions.length).toBe(43)

    await vi.advanceTimersByTimeAsync(1500)
    expect(fetchMockExam).toHaveBeenCalledTimes(3)
    expect(result.exam.value?.generation).toBe('ready')

    // Polling must stop the moment generation flips to ready — no further fetches.
    await vi.advanceTimersByTimeAsync(6000)
    expect(fetchMockExam).toHaveBeenCalledTimes(3)

    wrapper.unmount()
  })

  it('exposes loading then resolves the flat exam', async () => {
    vi.mocked(fetchMockExam).mockResolvedValue(exam('ready', 65))

    const { result, wrapper } = renderComposable(() => useMockExamAttempt('exam-1'))

    expect(result.isLoading.value).toBe(true)

    await vi.advanceTimersByTimeAsync(0)
    expect(result.isLoading.value).toBe(false)
    expect(result.isError.value).toBe(false)
    expect(result.exam.value?.id).toBe('exam-1')

    wrapper.unmount()
  })
})
