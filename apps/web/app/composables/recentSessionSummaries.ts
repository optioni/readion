import type { SessionResponseDto, SessionSummaryResponseDto } from '~~/src/api/model'
import { sessionSummaryControllerSummary } from '~~/src/api/session-summary/session-summary'

export const RECENT_SESSIONS_LIMIT = 3

const isCompleted = (session: SessionResponseDto) => String(session.status) === 'completed'

export async function fetchRecentSessionSummaries(
  sessions: SessionResponseDto[],
): Promise<Map<string, SessionSummaryResponseDto>> {
  const completed = sessions.filter(isCompleted).slice(0, RECENT_SESSIONS_LIMIT)
  const results = await Promise.all(
    completed.map(async (session) => {
      try {
        const response = await sessionSummaryControllerSummary(session.id)
        if (response.status !== 200) {
          return null
        }
        return [session.id, response.data.data] as const
      } catch {
        return null
      }
    }),
  )

  return new Map(
    results.filter((entry): entry is [string, SessionSummaryResponseDto] => entry !== null),
  )
}
