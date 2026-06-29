import type {
  MockExamResponseDto,
  SessionResponseDto,
  SessionSummaryResponseDto,
} from '~~/src/api/model'

export interface MergedHistoryRow {
  id: string
  startedAt: string | null
  kind: string
  durationMinutes: number | null
  questionsAnswered: number | null
  accuracy: number | null
  readinessDelta: number | null
  status: string
  score: number | null
}

const sessionToRow = (
  session: SessionResponseDto,
  summaries: Map<string, SessionSummaryResponseDto>,
): MergedHistoryRow => {
  const isCompleted = String(session.status) === 'completed'
  const summary = isCompleted ? summaries.get(session.id) : undefined

  const delta = summary?.readiness.delta
  return {
    id: session.id,
    startedAt: session.startedAt,
    kind: String(session.kind),
    durationMinutes: session.durationMinutes,
    questionsAnswered: summary?.questionsAnswered ?? null,
    accuracy: summary?.accuracy ?? null,
    readinessDelta: typeof delta === 'number' ? delta : null,
    status: String(session.status),
    score: null,
  }
}

const mockExamToRow = (attempt: MockExamResponseDto): MergedHistoryRow => ({
  id: attempt.id,
  startedAt: typeof attempt.startedAt === 'string' ? attempt.startedAt : null,
  kind: String(attempt.type),
  durationMinutes: null,
  questionsAnswered: attempt.questions.length > 0 ? attempt.questions.length : null,
  accuracy: null,
  readinessDelta: null,
  status: String(attempt.status),
  score: typeof attempt.score === 'number' ? attempt.score : null,
})

const byStartedAtDesc = (a: MergedHistoryRow, b: MergedHistoryRow): number => {
  if (a.startedAt === null && b.startedAt === null) {
    return 0
  }
  if (a.startedAt === null) {
    return 1
  }
  if (b.startedAt === null) {
    return -1
  }
  return a.startedAt > b.startedAt ? -1 : a.startedAt < b.startedAt ? 1 : 0
}

export function useSessionHistoryMerge(
  sessions: SessionResponseDto[],
  mockExams: MockExamResponseDto[],
  summaries: Map<string, SessionSummaryResponseDto>,
): MergedHistoryRow[] {
  const sessionRows = sessions.map((s) => sessionToRow(s, summaries))
  const mockRows = mockExams.map(mockExamToRow)
  return [...sessionRows, ...mockRows].sort(byStartedAtDesc)
}
