import type { MockExamResponse, SaveAnswerRequest } from '@readion/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  drillMockExam,
  fetchMockExam,
  fetchMockExamSummary,
  saveMockExamAnswer,
  submitMockExam,
} from '~/composables/mockExamApi'
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

vi.mock('~~/src/api/mock-exam/mock-exam', () => ({
  mockExamControllerFindOne: vi.fn(),
  mockExamControllerSaveAnswer: vi.fn(),
  mockExamControllerSubmit: vi.fn(),
}))
vi.mock('~~/src/api/mock-exam-summary/mock-exam-summary', () => ({
  mockExamSummaryControllerSummary: vi.fn(),
  mockExamSummaryControllerDrill: vi.fn(),
}))

// biome-ignore lint/suspicious/noExplicitAny: test fixtures are narrowed to the fields under assertion
const ok = (data: unknown, status = 200): any => ({ data, status, headers: new Headers() })

function mockExam(id: string): MockExamResponse {
  return {
    id,
    // biome-ignore lint/suspicious/noExplicitAny: fixture narrowed to the id under assertion
  } as any
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fetchMockExam', () => {
  it('GETs the mock exam and unwraps the envelope', async () => {
    vi.mocked(mockExamControllerFindOne).mockResolvedValue(ok({ data: mockExam('me-1') }))

    const result = await fetchMockExam('me-1')

    expect(mockExamControllerFindOne).toHaveBeenCalledWith('me-1')
    expect(result.id).toBe('me-1')
  })
})

describe('saveMockExamAnswer', () => {
  it('PUTs the answer body with a stringified zero-based index and unwraps the envelope', async () => {
    const body: SaveAnswerRequest = { answer: 'B' }
    vi.mocked(mockExamControllerSaveAnswer).mockResolvedValue(ok({ data: mockExam('me-1') }))

    const result = await saveMockExamAnswer('me-1', 0, body)

    expect(mockExamControllerSaveAnswer).toHaveBeenCalledWith('me-1', '0', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    expect(result.id).toBe('me-1')
  })

  it('stringifies a non-zero index into the path arg', async () => {
    vi.mocked(mockExamControllerSaveAnswer).mockResolvedValue(ok({ data: mockExam('me-1') }))

    await saveMockExamAnswer('me-1', 12, { answer: 'C' })

    expect(mockExamControllerSaveAnswer).toHaveBeenCalledWith('me-1', '12', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: 'C' }),
    })
  })
})

describe('submitMockExam', () => {
  it('POSTs the submit action and unwraps the envelope', async () => {
    vi.mocked(mockExamControllerSubmit).mockResolvedValue(ok({ data: mockExam('me-1') }))

    const result = await submitMockExam('me-1')

    expect(mockExamControllerSubmit).toHaveBeenCalledWith('me-1')
    expect(result.id).toBe('me-1')
  })
})

describe('fetchMockExamSummary', () => {
  it('GETs the summary and unwraps the double envelope', async () => {
    const summary = { accuracy: 0.9 } as SessionSummaryResponseDto
    vi.mocked(mockExamSummaryControllerSummary).mockResolvedValue(ok({ data: summary }))

    const result = await fetchMockExamSummary('me-1')

    expect(mockExamSummaryControllerSummary).toHaveBeenCalledWith('me-1')
    expect(result).toEqual(summary)
  })
})

describe('drillMockExam', () => {
  it('POSTs the drill action and unwraps the envelope', async () => {
    const drill: DrillResultResponseDto = { status: 'started', session: { id: 'sess-2' } }
    vi.mocked(mockExamSummaryControllerDrill).mockResolvedValue(ok({ data: drill }))

    const result = await drillMockExam('me-1')

    expect(mockExamSummaryControllerDrill).toHaveBeenCalledWith('me-1')
    expect(result.status).toBe('started')
    expect(result.session?.id).toBe('sess-2')
  })
})
