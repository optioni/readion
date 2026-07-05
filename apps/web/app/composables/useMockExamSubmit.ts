import { useQueryClient } from '@tanstack/vue-query'
import { ref } from 'vue'
import { ReadionProblemDetailsError } from '~/api/mutator'
import { submitMockExam } from '~/composables/mockExamApi'
import { mockExamQueryKeys } from '~/composables/mockExamQueryKeys'
import { useTrack } from '~/composables/useTrack'

const CONFLICT_STATUS = 409

// The cron that expires timed attempts races with manual/auto submit: a 409 means the attempt is already
// terminal. The mutator rejects on non-2xx, so the conflict normally surfaces as a thrown
// `ReadionProblemDetailsError`; a resolved `{ status: 409 }` is handled defensively for the same reason.
function isTerminalConflict(value: unknown): boolean {
  if (value instanceof ReadionProblemDetailsError) {
    return value.status === CONFLICT_STATUS
  }
  if (typeof value === 'object' && value !== null && 'status' in value) {
    return (value as { status: unknown }).status === CONFLICT_STATUS
  }
  return false
}

export function useMockExamSubmit(examId: string) {
  const queryClient = useQueryClient()
  const { track } = useTrack()

  const confirmOpen = ref(false)
  const isSubmitting = ref(false)

  function requestSubmit(): void {
    confirmOpen.value = true
  }

  function cancelSubmit(): void {
    confirmOpen.value = false
  }

  // The detail cache is the single source of truth for the page's scene: writing the terminal attempt (or
  // refetching it after a cron-race) flips `selectMockExamScene` to `'results'`.
  async function refetchTerminal(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: mockExamQueryKeys.detail(examId) })
  }

  async function runSubmit(auto: boolean): Promise<void> {
    if (isSubmitting.value) {
      return
    }
    isSubmitting.value = true
    try {
      const terminal = await submitMockExam(examId)
      if (isTerminalConflict(terminal)) {
        await refetchTerminal()
        return
      }
      queryClient.setQueryData(mockExamQueryKeys.detail(examId), terminal)
      track('mock_exam_submitted', { auto })
    } catch (error) {
      if (isTerminalConflict(error)) {
        await refetchTerminal()
        return
      }
      throw error
    } finally {
      isSubmitting.value = false
    }
  }

  async function confirmSubmit(): Promise<void> {
    confirmOpen.value = false
    await runSubmit(false)
  }

  async function autoSubmit(): Promise<void> {
    await runSubmit(true)
  }

  return {
    confirmOpen,
    isSubmitting,
    requestSubmit,
    cancelSubmit,
    confirmSubmit,
    autoSubmit,
  }
}
