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

  async function startSession() {
    if (isStartingSession.value) {
      return
    }
    isStartingSession.value = true
    try {
      const response = await enrollmentSessionsControllerCreate(enrollmentId)
      track('session_started', { enrollmentId, resumed: (response.status as number) === 200 })
      router.push(sessionRunPath(response.data.data.id))
    } finally {
      isStartingSession.value = false
    }
  }

  async function startMockExam() {
    if (isStartingMockExam.value) {
      return
    }
    isStartingMockExam.value = true
    try {
      const response = await enrollmentMockExamControllerCreate(enrollmentId)
      track('mock_exam_started', { enrollmentId })
      router.push(mockExamRunPath(response.data.data.id))
    } finally {
      isStartingMockExam.value = false
    }
  }

  return { startSession, startMockExam, isStartingSession, isStartingMockExam }
}
