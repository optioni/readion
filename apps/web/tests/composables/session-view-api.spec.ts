import type { CreateSessionRequest, SubmitAnswerRequest } from '@readion/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  completeSessionItem,
  createSession,
  createSessionAgentConversation,
  drillSession,
  endSession,
  fetchAgentConversation,
  fetchSessionDetail,
  fetchSessionSummary,
  generateQuizExplanation,
  goDeeperOnItem,
  reportQuizQuestion,
  submitQuizAnswer,
} from '~/composables/sessionViewApi'
import { agentControllerDetail } from '~~/src/api/agent/agent'
import { enrollmentSessionsControllerCreate } from '~~/src/api/enrollment-sessions/enrollment-sessions'
import type {
  AgentConversationDetailResponseDto,
  DrillResultResponseDto,
  GoDeeperResponseDto,
  SessionDetailResponseDto,
  SessionSummaryResponseDto,
} from '~~/src/api/model'
import {
  quizControllerGenerateExplanation,
  quizControllerReportQuestion,
  quizControllerSubmitAnswer,
} from '~~/src/api/quiz/quiz'
import { sessionAgentConversationsControllerCreateInSession } from '~~/src/api/session-agent-conversations/session-agent-conversations'
import {
  sessionSummaryControllerDrill,
  sessionSummaryControllerSummary,
} from '~~/src/api/session-summary/session-summary'
import {
  sessionsControllerCompleteItem,
  sessionsControllerDetail,
  sessionsControllerEnd,
  sessionsControllerGoDeeper,
} from '~~/src/api/sessions/sessions'
import { clearUmamiRecorder, installUmamiRecorder } from '../support/umami-recorder'

vi.mock('~~/src/api/enrollment-sessions/enrollment-sessions', () => ({
  enrollmentSessionsControllerCreate: vi.fn(),
}))
vi.mock('~~/src/api/sessions/sessions', () => ({
  sessionsControllerDetail: vi.fn(),
  sessionsControllerCompleteItem: vi.fn(),
  sessionsControllerGoDeeper: vi.fn(),
  sessionsControllerEnd: vi.fn(),
}))
vi.mock('~~/src/api/quiz/quiz', () => ({
  quizControllerSubmitAnswer: vi.fn(),
  quizControllerGenerateExplanation: vi.fn(),
  quizControllerReportQuestion: vi.fn(),
}))
vi.mock('~~/src/api/session-summary/session-summary', () => ({
  sessionSummaryControllerSummary: vi.fn(),
  sessionSummaryControllerDrill: vi.fn(),
}))
vi.mock('~~/src/api/session-agent-conversations/session-agent-conversations', () => ({
  sessionAgentConversationsControllerCreateInSession: vi.fn(),
}))
vi.mock('~~/src/api/agent/agent', () => ({
  agentControllerDetail: vi.fn(),
}))

// biome-ignore lint/suspicious/noExplicitAny: test fixtures are narrowed to the fields under assertion
const ok = (data: unknown, status = 200): any => ({ data, status, headers: new Headers() })

function sessionDetail(id: string): SessionDetailResponseDto {
  return {
    data: {
      id,
      // biome-ignore lint/suspicious/noExplicitAny: fixture narrowed to the id under assertion
    } as any,
    relationships: {},
    // biome-ignore lint/suspicious/noExplicitAny: fixture narrowed to the id under assertion
  } as any
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createSession', () => {
  it('POSTs an empty body for quick start (server applies profile defaults)', async () => {
    vi.mocked(enrollmentSessionsControllerCreate).mockResolvedValue(
      ok(sessionDetail('sess-1'), 201),
    )

    const result = await createSession('enr-1')

    expect(enrollmentSessionsControllerCreate).toHaveBeenCalledWith('enr-1', undefined)
    expect(result.data.id).toBe('sess-1')
  })

  it('serialises the override body for custom config', async () => {
    vi.mocked(enrollmentSessionsControllerCreate).mockResolvedValue(
      ok(sessionDetail('sess-1'), 201),
    )
    const body: CreateSessionRequest = { durationMinutes: 30, difficulty: 'intermediate' }

    await createSession('enr-1', body)

    expect(enrollmentSessionsControllerCreate).toHaveBeenCalledWith('enr-1', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  })

  it('treats 200 (resume) and 201 (new) identically', async () => {
    vi.mocked(enrollmentSessionsControllerCreate).mockResolvedValueOnce(
      ok(sessionDetail('sess-9'), 201),
    )
    const created = await createSession('enr-1')

    vi.mocked(enrollmentSessionsControllerCreate).mockResolvedValueOnce(
      ok(sessionDetail('sess-9'), 200),
    )
    const resumed = await createSession('enr-1')

    expect(created.data.id).toBe('sess-9')
    expect(resumed.data.id).toBe('sess-9')
    expect(resumed).toEqual(created)
  })
})

describe('fetchSessionDetail', () => {
  it('GETs the session with its items and unwraps the envelope', async () => {
    vi.mocked(sessionsControllerDetail).mockResolvedValue(ok(sessionDetail('sess-1')))

    const result = await fetchSessionDetail('sess-1')

    expect(sessionsControllerDetail).toHaveBeenCalledWith('sess-1', { include: 'items' })
    expect(result.data.id).toBe('sess-1')
  })
})

describe('completeSessionItem', () => {
  it('POSTs item completion with a string index and unwraps the envelope', async () => {
    vi.mocked(sessionsControllerCompleteItem).mockResolvedValue(ok(sessionDetail('sess-1')))

    const result = await completeSessionItem('sess-1', 3)

    expect(sessionsControllerCompleteItem).toHaveBeenCalledWith('sess-1', '3')
    expect(result.data.id).toBe('sess-1')
  })
})

describe('goDeeperOnItem', () => {
  it('POSTs go-deeper and returns the expanded content', async () => {
    const expanded: GoDeeperResponseDto = { expandedContent: 'more' }
    vi.mocked(sessionsControllerGoDeeper).mockResolvedValue(ok(expanded))

    const result = await goDeeperOnItem('sess-1', 2)

    expect(sessionsControllerGoDeeper).toHaveBeenCalledWith('sess-1', '2')
    expect(result.expandedContent).toBe('more')
  })
})

describe('endSession', () => {
  it('POSTs to end the session and unwraps the envelope', async () => {
    vi.mocked(sessionsControllerEnd).mockResolvedValue(ok(sessionDetail('sess-1')))

    const result = await endSession('sess-1')

    expect(sessionsControllerEnd).toHaveBeenCalledWith('sess-1')
    expect(result.data.id).toBe('sess-1')
  })
})

describe('submitQuizAnswer', () => {
  it('POSTs the answer body to the question and unwraps the response', async () => {
    const body: SubmitAnswerRequest = {
      userCertificationId: 'enr-1',
      answer: 'A',
      confidence: 4,
      timeTakenMs: 1200,
    }
    vi.mocked(quizControllerSubmitAnswer).mockResolvedValue(
      ok({ data: { id: 'resp-1', correct: true, answer: 'A', confidence: 4, timeTakenMs: 1200 } }),
    )

    const result = await submitQuizAnswer('q-1', body)

    expect(quizControllerSubmitAnswer).toHaveBeenCalledWith('q-1', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    expect(result.correct).toBe(true)
    expect(result.id).toBe('resp-1')
  })
})

describe('generateQuizExplanation', () => {
  it('POSTs the explanation request and unwraps the response', async () => {
    const body = { userCertificationId: 'enr-1' }
    vi.mocked(quizControllerGenerateExplanation).mockResolvedValue(
      ok({ data: { explanation: 'because', citations: ['c1'] } }),
    )

    const result = await generateQuizExplanation('q-1', body)

    expect(quizControllerGenerateExplanation).toHaveBeenCalledWith('q-1', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    expect(result.explanation).toBe('because')
    expect(result.citations).toEqual(['c1'])
  })
})

describe('reportQuizQuestion', () => {
  it('POSTs the report reason and resolves on 204', async () => {
    const body = { userCertificationId: 'enr-1', reason: 'wrong' }
    vi.mocked(quizControllerReportQuestion).mockResolvedValue(ok(undefined, 204))

    await reportQuizQuestion('q-1', body)

    expect(quizControllerReportQuestion).toHaveBeenCalledWith('q-1', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  })
})

describe('fetchSessionSummary', () => {
  it('GETs the summary and unwraps the envelope', async () => {
    const summary = { accuracy: 0.8 } as SessionSummaryResponseDto
    vi.mocked(sessionSummaryControllerSummary).mockResolvedValue(ok({ data: summary }))

    const result = await fetchSessionSummary('sess-1')

    expect(sessionSummaryControllerSummary).toHaveBeenCalledWith('sess-1')
    expect(result).toEqual(summary)
  })
})

describe('drillSession', () => {
  it('POSTs the drill action and unwraps the envelope', async () => {
    const drill: DrillResultResponseDto = { status: 'started', session: { id: 'sess-2' } }
    vi.mocked(sessionSummaryControllerDrill).mockResolvedValue(ok({ data: drill }))

    const result = await drillSession('sess-1')

    expect(sessionSummaryControllerDrill).toHaveBeenCalledWith('sess-1')
    expect(result.status).toBe('started')
    expect(result.session?.id).toBe('sess-2')
  })
})

describe('createSessionAgentConversation', () => {
  it('POSTs to ensure an in-session conversation and unwraps the envelope', async () => {
    const conversation = {
      data: { id: 'conv-1' },
      relationships: {},
      // biome-ignore lint/suspicious/noExplicitAny: fixture narrowed to the id under assertion
    } as any as AgentConversationDetailResponseDto
    vi.mocked(sessionAgentConversationsControllerCreateInSession).mockResolvedValue(
      ok(conversation),
    )

    const result = await createSessionAgentConversation('sess-1')

    expect(sessionAgentConversationsControllerCreateInSession).toHaveBeenCalledWith('sess-1')
    expect(result.data.id).toBe('conv-1')
  })
})

describe('fetchAgentConversation', () => {
  it('GETs the conversation with its messages and unwraps the envelope', async () => {
    const conversation = {
      data: { id: 'conv-1' },
      relationships: { messages: { data: [] } },
      // biome-ignore lint/suspicious/noExplicitAny: fixture narrowed to the id under assertion
    } as any as AgentConversationDetailResponseDto
    vi.mocked(agentControllerDetail).mockResolvedValue(ok(conversation))

    const result = await fetchAgentConversation('conv-1')

    expect(agentControllerDetail).toHaveBeenCalledWith('conv-1', { include: 'messages' })
    expect(result.data.id).toBe('conv-1')
  })
})

describe('session analytics events', () => {
  let recorder: ReturnType<typeof installUmamiRecorder>

  beforeEach(() => {
    recorder = installUmamiRecorder()
  })

  afterEach(() => {
    clearUmamiRecorder()
  })

  it('session_started reports resumed=false on 201 (new) and true on 200 (resume)', async () => {
    vi.mocked(enrollmentSessionsControllerCreate).mockResolvedValueOnce(
      ok(sessionDetail('sess-1'), 201),
    )
    await createSession('enr-1')
    expect(recorder.track).toHaveBeenCalledWith('session_started', {
      enrollmentId: 'enr-1',
      resumed: false,
    })

    vi.mocked(enrollmentSessionsControllerCreate).mockResolvedValueOnce(
      ok(sessionDetail('sess-1'), 200),
    )
    await createSession('enr-1')
    expect(recorder.track).toHaveBeenCalledWith('session_started', {
      enrollmentId: 'enr-1',
      resumed: true,
    })
  })

  it('quiz_answer_submitted carries the correctness', async () => {
    vi.mocked(quizControllerSubmitAnswer).mockResolvedValue(
      ok({ data: { id: 'r', correct: false, answer: 'A', confidence: 3, timeTakenMs: 100 } }),
    )
    await submitQuizAnswer('q-1', {
      userCertificationId: 'enr-1',
      answer: 'A',
      confidence: 3,
      timeTakenMs: 100,
    })
    expect(recorder.track).toHaveBeenCalledWith('quiz_answer_submitted', { correct: false })
  })

  it('emits go_deeper_used, quiz_explanation_generated, quiz_question_reported, session_ended, drill_started', async () => {
    vi.mocked(sessionsControllerGoDeeper).mockResolvedValue(ok({ expandedContent: 'x' }))
    vi.mocked(quizControllerGenerateExplanation).mockResolvedValue(
      ok({ data: { explanation: 'e', citations: [] } }),
    )
    vi.mocked(quizControllerReportQuestion).mockResolvedValue(ok(undefined, 204))
    vi.mocked(sessionsControllerEnd).mockResolvedValue(ok(sessionDetail('sess-1')))
    vi.mocked(sessionSummaryControllerDrill).mockResolvedValue(ok({ data: { status: 'started' } }))

    await goDeeperOnItem('sess-1', 0)
    await generateQuizExplanation('q-1', { userCertificationId: 'enr-1' })
    await reportQuizQuestion('q-1', { userCertificationId: 'enr-1', reason: 'wrong' })
    await endSession('sess-1')
    await drillSession('sess-1')

    const names = recorder.events.map((e) => e.event)
    expect(names).toEqual([
      'go_deeper_used',
      'quiz_explanation_generated',
      'quiz_question_reported',
      'session_ended',
      'drill_started',
    ])
  })
})
