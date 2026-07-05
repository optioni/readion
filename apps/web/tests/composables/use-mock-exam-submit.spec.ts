import type { MockExamResponse } from '@readion/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReadionProblemDetailsError } from '~/api/mutator'
import { submitMockExam } from '~/composables/mockExamApi'
import { mockExamQueryKeys } from '~/composables/mockExamQueryKeys'
import { useMockExamSubmit } from '~/composables/useMockExamSubmit'
import { clearUmamiRecorder, installUmamiRecorder } from '../support/umami-recorder'
import { renderComposable } from '../support/vue-query-harness'

vi.mock('~/composables/mockExamApi', () => ({ submitMockExam: vi.fn() }))

const EXAM_ID = 'exam-1'

function terminalExam(status: 'submitted' | 'expired'): MockExamResponse {
  return {
    id: EXAM_ID,
    userCertificationId: 'enr-1',
    type: 'mock',
    status,
    generation: 'ready',
    startedAt: '2026-06-29T10:00:00.000Z',
    deadline: '2026-06-29T11:47:23.000Z',
    remainingSeconds: 0,
    score: 73,
    passed: true,
    domainBreakdown: {},
    questions: [],
  }
}

describe('useMockExamSubmit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('requestSubmit opens the confirmation and cancelSubmit closes it', () => {
    const { result, wrapper } = renderComposable(() => useMockExamSubmit(EXAM_ID))

    expect(result.confirmOpen.value).toBe(false)
    result.requestSubmit()
    expect(result.confirmOpen.value).toBe(true)
    result.cancelSubmit()
    expect(result.confirmOpen.value).toBe(false)

    wrapper.unmount()
  })

  it('confirmSubmit submits and writes the terminal attempt into the detail cache', async () => {
    const terminal = terminalExam('submitted')
    vi.mocked(submitMockExam).mockResolvedValue(terminal)

    const { result, wrapper, queryClient } = renderComposable(() => useMockExamSubmit(EXAM_ID))
    const setSpy = vi.spyOn(queryClient, 'setQueryData')

    result.requestSubmit()
    await result.confirmSubmit()

    expect(submitMockExam).toHaveBeenCalledWith(EXAM_ID)
    expect(setSpy).toHaveBeenCalledWith(mockExamQueryKeys.detail(EXAM_ID), terminal)
    expect(queryClient.getQueryData(mockExamQueryKeys.detail(EXAM_ID))).toEqual(terminal)
    expect(result.confirmOpen.value).toBe(false)

    wrapper.unmount()
  })

  it('autoSubmit submits without opening the confirmation', async () => {
    const terminal = terminalExam('expired')
    vi.mocked(submitMockExam).mockResolvedValue(terminal)

    const { result, wrapper, queryClient } = renderComposable(() => useMockExamSubmit(EXAM_ID))
    const setSpy = vi.spyOn(queryClient, 'setQueryData')

    await result.autoSubmit()

    expect(result.confirmOpen.value).toBe(false)
    expect(submitMockExam).toHaveBeenCalledWith(EXAM_ID)
    expect(setSpy).toHaveBeenCalledWith(mockExamQueryKeys.detail(EXAM_ID), terminal)

    wrapper.unmount()
  })

  it('treats a thrown 409 as the cron-race: refetches the detail key without surfacing an error', async () => {
    vi.mocked(submitMockExam).mockRejectedValue(
      new ReadionProblemDetailsError({ title: 'Conflict', status: 409 }),
    )

    const { result, wrapper, queryClient } = renderComposable(() => useMockExamSubmit(EXAM_ID))
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const setSpy = vi.spyOn(queryClient, 'setQueryData')

    await expect(result.autoSubmit()).resolves.toBeUndefined()

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: mockExamQueryKeys.detail(EXAM_ID) })
    expect(setSpy).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('treats a resolved 409 response as the cron-race and refetches without surfacing an error', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: defensive non-throwing 409 fixture
    vi.mocked(submitMockExam).mockResolvedValue({ status: 409 } as any)

    const { result, wrapper, queryClient } = renderComposable(() => useMockExamSubmit(EXAM_ID))
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const setSpy = vi.spyOn(queryClient, 'setQueryData')

    await expect(result.confirmSubmit()).resolves.toBeUndefined()

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: mockExamQueryKeys.detail(EXAM_ID) })
    expect(setSpy).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('rethrows non-conflict errors so genuine failures are not swallowed', async () => {
    vi.mocked(submitMockExam).mockRejectedValue(
      new ReadionProblemDetailsError({ title: 'Server error', status: 500 }),
    )

    const { result, wrapper } = renderComposable(() => useMockExamSubmit(EXAM_ID))

    await expect(result.confirmSubmit()).rejects.toThrow()

    wrapper.unmount()
  })

  describe('analytics events', () => {
    let recorder: ReturnType<typeof installUmamiRecorder>

    beforeEach(() => {
      recorder = installUmamiRecorder()
    })

    afterEach(() => {
      clearUmamiRecorder()
    })

    it('emits mock_exam_submitted { auto: false } for a manual confirm', async () => {
      vi.mocked(submitMockExam).mockResolvedValue(terminalExam('submitted'))

      const { result, wrapper } = renderComposable(() => useMockExamSubmit(EXAM_ID))
      result.requestSubmit()
      await result.confirmSubmit()

      expect(recorder.track).toHaveBeenCalledWith('mock_exam_submitted', { auto: false })
      wrapper.unmount()
    })

    it('emits mock_exam_submitted { auto: true } for a timer expiry', async () => {
      vi.mocked(submitMockExam).mockResolvedValue(terminalExam('expired'))

      const { result, wrapper } = renderComposable(() => useMockExamSubmit(EXAM_ID))
      await result.autoSubmit()

      expect(recorder.track).toHaveBeenCalledWith('mock_exam_submitted', { auto: true })
      wrapper.unmount()
    })

    it('does not emit when a terminal conflict short-circuits the submit', async () => {
      vi.mocked(submitMockExam).mockRejectedValue(
        new ReadionProblemDetailsError({ title: 'Conflict', status: 409 }),
      )

      const { result, wrapper } = renderComposable(() => useMockExamSubmit(EXAM_ID))
      await result.autoSubmit()

      expect(recorder.track).not.toHaveBeenCalled()
      wrapper.unmount()
    })
  })
})
