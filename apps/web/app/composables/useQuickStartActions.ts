import { ref } from 'vue'
import { mockExamRunPath, sessionRunPath } from '~/composables/runnerRoutes'
import { useTrack } from '~/composables/useTrack'
import { enrollmentMockExamControllerCreate } from '~~/src/api/enrollment-mock-exam/enrollment-mock-exam'
import { enrollmentSessionsControllerCreate } from '~~/src/api/enrollment-sessions/enrollment-sessions'

export function useQuickStartActions(enrollmentId: string) {
  const router = useRouter()
  const { track } = useTrack()
  const isStartingSession = ref(false)
  const isStartingMockExam = ref(false)
  const sessionError = ref<string | null>(null)
  const mockExamError = ref<string | null>(null)

  async function startSession() {
    if (isStartingSession.value) {
      return
    }
    sessionError.value = null
    isStartingSession.value = true
    try {
      const response = await enrollmentSessionsControllerCreate(enrollmentId)
      track('session_started', { enrollmentId, resumed: (response.status as number) === 200 })
      router.push(sessionRunPath(response.data.data.id))
    } catch {
      sessionError.value = "Couldn't start the session. Try again."
    } finally {
      isStartingSession.value = false
    }
  }

  async function startMockExam() {
    if (isStartingMockExam.value) {
      return
    }
    mockExamError.value = null
    isStartingMockExam.value = true
    try {
      const response = await enrollmentMockExamControllerCreate(enrollmentId)
      track('mock_exam_started', { enrollmentId })
      router.push(mockExamRunPath(response.data.data.id))
    } catch {
      mockExamError.value = "Couldn't start the mock exam. Try again."
    } finally {
      isStartingMockExam.value = false
    }
  }

  return {
    startSession,
    startMockExam,
    isStartingSession,
    isStartingMockExam,
    sessionError,
    mockExamError,
  } as {
    startSession: typeof startSession
    startMockExam: typeof startMockExam
    isStartingSession: typeof isStartingSession
    isStartingMockExam: typeof isStartingMockExam
    sessionError?: typeof sessionError
    mockExamError?: typeof mockExamError
  }
}
