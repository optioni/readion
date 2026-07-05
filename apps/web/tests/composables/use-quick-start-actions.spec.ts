import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useQuickStartActions } from '~/composables/useQuickStartActions'
import { enrollmentMockExamControllerCreate } from '~~/src/api/enrollment-mock-exam/enrollment-mock-exam'
import { enrollmentSessionsControllerCreate } from '~~/src/api/enrollment-sessions/enrollment-sessions'
import { clearUmamiRecorder, installUmamiRecorder } from '../support/umami-recorder'

vi.mock('~~/src/api/enrollment-sessions/enrollment-sessions', () => ({
  enrollmentSessionsControllerCreate: vi.fn(),
}))
vi.mock('~~/src/api/enrollment-mock-exam/enrollment-mock-exam', () => ({
  enrollmentMockExamControllerCreate: vi.fn(),
}))

const mockPush = vi.fn()
vi.stubGlobal('useRouter', () => ({ push: mockPush }))

function stubSession(id: string) {
  vi.mocked(enrollmentSessionsControllerCreate).mockResolvedValue({
    data: {
      data: {
        id,
        userCertificationId: 'enr-1',
        kind: 'standard',
        status: 'in_progress',
        durationMinutes: 30,
        contentMix: 'balanced',
        difficulty: 'medium',
        focusArea: null,
        learningStyle: 'mixed',
        lastItemIndex: 0,
        startedAt: '2026-06-01T00:00:00Z',
      },
      relationships: {},
      // biome-ignore lint/suspicious/noExplicitAny: test fixture narrowed to fields under assertion
    } as any,
    status: 201,
    headers: new Headers(),
  })
}

function stubMockExam(id: string) {
  vi.mocked(enrollmentMockExamControllerCreate).mockResolvedValue({
    data: {
      data: {
        id,
        userCertificationId: 'enr-1',
        type: 'full',
        status: 'in_progress',
        generation: 'ready',
        domainBreakdown: [],
        questions: [],
      },
      // biome-ignore lint/suspicious/noExplicitAny: test fixture narrowed to fields under assertion
    } as any,
    status: 201,
    headers: new Headers(),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useQuickStartActions startSession', () => {
  it('POSTs to create a session then navigates to its run path', async () => {
    stubSession('sess-9')
    const { startSession } = useQuickStartActions('enr-1')

    await startSession()

    expect(enrollmentSessionsControllerCreate).toHaveBeenCalledWith('enr-1')
    expect(mockPush).toHaveBeenCalledWith('/sessions/sess-9')
  })

  it('tracks the in-flight session state', async () => {
    stubSession('sess-9')
    const { startSession, isStartingSession } = useQuickStartActions('enr-1')

    expect(isStartingSession.value).toBe(false)
    const pending = startSession()
    expect(isStartingSession.value).toBe(true)
    await pending
    expect(isStartingSession.value).toBe(false)
  })

  it('ignores re-entrant clicks while a session POST is in flight', async () => {
    stubSession('sess-9')
    const { startSession } = useQuickStartActions('enr-1')

    await Promise.all([startSession(), startSession()])

    expect(enrollmentSessionsControllerCreate).toHaveBeenCalledTimes(1)
  })
})

describe('useQuickStartActions startMockExam', () => {
  it('POSTs to create a mock exam then navigates to its run path', async () => {
    stubMockExam('mock-7')
    const { startMockExam } = useQuickStartActions('enr-1')

    await startMockExam()

    expect(enrollmentMockExamControllerCreate).toHaveBeenCalledWith('enr-1')
    expect(mockPush).toHaveBeenCalledWith('/mock-exams/mock-7')
  })

  it('tracks the in-flight mock-exam state', async () => {
    stubMockExam('mock-7')
    const { startMockExam, isStartingMockExam } = useQuickStartActions('enr-1')

    expect(isStartingMockExam.value).toBe(false)
    const pending = startMockExam()
    expect(isStartingMockExam.value).toBe(true)
    await pending
    expect(isStartingMockExam.value).toBe(false)
  })
})

describe('useQuickStartActions analytics events', () => {
  let recorder: ReturnType<typeof installUmamiRecorder>

  beforeEach(() => {
    recorder = installUmamiRecorder()
  })

  afterEach(() => {
    clearUmamiRecorder()
  })

  it('emits session_started (resumed=false on 201) with the enrollmentId', async () => {
    stubSession('sess-9')
    const { startSession } = useQuickStartActions('enr-1')

    await startSession()

    expect(recorder.track).toHaveBeenCalledWith('session_started', {
      enrollmentId: 'enr-1',
      resumed: false,
    })
  })

  it('emits mock_exam_started with the enrollmentId', async () => {
    stubMockExam('mock-7')
    const { startMockExam } = useQuickStartActions('enr-1')

    await startMockExam()

    expect(recorder.track).toHaveBeenCalledWith('mock_exam_started', { enrollmentId: 'enr-1' })
  })
})
