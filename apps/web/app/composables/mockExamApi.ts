import type { MockExamResponse, SaveAnswerRequest } from '@readion/shared'
import {
  mockExamControllerFindOne,
  mockExamControllerSaveAnswer,
  mockExamControllerSubmit,
} from '~~/src/api/mock-exam/mock-exam'
import {
  mockExamSummaryControllerDrill,
  mockExamSummaryControllerSummary,
} from '~~/src/api/mock-exam-summary/mock-exam-summary'
import type { DrillResultResponseDto, SessionSummaryResponseDto } from '~~/src/api/model'

const jsonHeaders = { 'Content-Type': 'application/json' }

const jsonBody = (body: unknown): RequestInit => ({
  headers: jsonHeaders,
  body: JSON.stringify(body),
})

// The mock-exam endpoints wrap the resource in the standard `{ data }` success envelope; the
// generated client surfaces that as `response.data`, so the payload lives one level deeper.
const unwrapEnvelope = <T>(response: { data: unknown }): T => (response.data as { data: T }).data

export async function fetchMockExam(id: string): Promise<MockExamResponse> {
  const response = await mockExamControllerFindOne(id)
  return unwrapEnvelope<MockExamResponse>(response)
}

export async function saveMockExamAnswer(
  id: string,
  questionIndex: number,
  body: SaveAnswerRequest,
): Promise<MockExamResponse> {
  const response = await mockExamControllerSaveAnswer(id, String(questionIndex), jsonBody(body))
  return unwrapEnvelope<MockExamResponse>(response)
}

export async function submitMockExam(id: string): Promise<MockExamResponse> {
  const response = await mockExamControllerSubmit(id)
  return unwrapEnvelope<MockExamResponse>(response)
}

export async function fetchMockExamSummary(id: string): Promise<SessionSummaryResponseDto> {
  const response = await mockExamSummaryControllerSummary(id)
  return unwrapEnvelope<SessionSummaryResponseDto>(response)
}

export async function drillMockExam(id: string): Promise<DrillResultResponseDto> {
  const response = await mockExamSummaryControllerDrill(id)
  return unwrapEnvelope<DrillResultResponseDto>(response)
}
