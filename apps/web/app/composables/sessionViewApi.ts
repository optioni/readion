import type {
  CreateSessionRequest,
  ExplanationRequest,
  ExplanationResponse,
  ReportRequest,
  SubmitAnswerRequest,
  SubmitAnswerResponse,
} from '@readion/shared'
import { useTrack } from '~/composables/useTrack'
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

const jsonHeaders = { 'Content-Type': 'application/json' }

const jsonBody = (body: unknown): RequestInit => ({
  headers: jsonHeaders,
  body: JSON.stringify(body),
})

// Several quiz endpoints have no response schema in the OpenAPI doc, so the generated
// client types their body as `void`; narrow the success envelope to read the payload.
const unwrapEnvelope = <T>(response: { data: unknown }): T => (response.data as { data: T }).data

export async function createSession(
  enrollmentId: string,
  overrides?: CreateSessionRequest,
): Promise<SessionDetailResponseDto> {
  // The backend returns 201 for a new session or 200 when resuming the existing active
  // session; both carry the session in the same envelope, so navigation is identical.
  const response = await enrollmentSessionsControllerCreate(
    enrollmentId,
    overrides ? jsonBody(overrides) : undefined,
  )
  // The generated client narrows `status` to the documented 201; at runtime a resumed session
  // comes back as 200, so read the actual status to distinguish new from resumed.
  const resumed = (response.status as number) === 200
  useTrack().track('session_started', { enrollmentId, resumed })
  return response.data
}

export async function fetchSessionDetail(sessionId: string): Promise<SessionDetailResponseDto> {
  const response = await sessionsControllerDetail(sessionId, { include: 'items' })
  return response.data
}

export async function completeSessionItem(
  sessionId: string,
  index: number,
): Promise<SessionDetailResponseDto> {
  const response = await sessionsControllerCompleteItem(sessionId, String(index))
  return response.data
}

export async function goDeeperOnItem(
  sessionId: string,
  index: number,
): Promise<GoDeeperResponseDto> {
  const response = await sessionsControllerGoDeeper(sessionId, String(index))
  useTrack().track('go_deeper_used')
  return response.data
}

export async function endSession(sessionId: string): Promise<SessionDetailResponseDto> {
  const response = await sessionsControllerEnd(sessionId)
  useTrack().track('session_ended')
  return response.data
}

export async function submitQuizAnswer(
  questionId: string,
  body: SubmitAnswerRequest,
): Promise<SubmitAnswerResponse> {
  const response = await quizControllerSubmitAnswer(questionId, jsonBody(body))
  const result = unwrapEnvelope<SubmitAnswerResponse>(response)
  useTrack().track('quiz_answer_submitted', { correct: result.correct })
  return result
}

export async function generateQuizExplanation(
  questionId: string,
  body: ExplanationRequest,
): Promise<ExplanationResponse> {
  const response = await quizControllerGenerateExplanation(questionId, jsonBody(body))
  useTrack().track('quiz_explanation_generated')
  return unwrapEnvelope<ExplanationResponse>(response)
}

export async function reportQuizQuestion(questionId: string, body: ReportRequest): Promise<void> {
  await quizControllerReportQuestion(questionId, jsonBody(body))
  useTrack().track('quiz_question_reported')
}

export async function fetchSessionSummary(sessionId: string): Promise<SessionSummaryResponseDto> {
  const response = await sessionSummaryControllerSummary(sessionId)
  return unwrapEnvelope<SessionSummaryResponseDto>(response)
}

export async function drillSession(sessionId: string): Promise<DrillResultResponseDto> {
  const response = await sessionSummaryControllerDrill(sessionId)
  useTrack().track('drill_started')
  return unwrapEnvelope<DrillResultResponseDto>(response)
}

export async function createSessionAgentConversation(
  sessionId: string,
): Promise<AgentConversationDetailResponseDto> {
  const response = await sessionAgentConversationsControllerCreateInSession(sessionId)
  return response.data
}

export async function fetchAgentConversation(
  conversationId: string,
): Promise<AgentConversationDetailResponseDto> {
  const response = await agentControllerDetail(conversationId, { include: 'messages' })
  return response.data
}
