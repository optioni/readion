import { EntityManager } from '@mikro-orm/core'
import { Injectable } from '@nestjs/common'
import { ContentChunk, MockExam, QuizResponse, StudySession } from '@readion/db'
import type {
  RawMockStat,
  RawSessionStat,
  SessionHistoryPort,
  SessionHistoryRead,
} from './agent-tools.types'

type DomainTally = { correct: number; total: number }

const computeAccuracy = (tally: DomainTally): number =>
  tally.total === 0 ? 0 : tally.correct / tally.total

@Injectable()
export class SessionHistoryReader implements SessionHistoryPort {
  constructor(private readonly em: EntityManager) {}

  async read(userId: string, enrollmentId: string, limit: number): Promise<SessionHistoryRead> {
    const em = this.em.fork()

    const studySessions = await em.find(
      StudySession,
      { user: userId, userCertification: enrollmentId },
      { orderBy: { startedAt: 'DESC' }, limit },
    )

    const responses = await em.find(QuizResponse, { userCertification: enrollmentId })

    const chunkIds = [
      ...new Set(responses.flatMap((r) => r.questionSnapshot.provenance.sourceChunkIds)),
    ]
    const chunks = chunkIds.length > 0 ? await em.find(ContentChunk, { id: { $in: chunkIds } }) : []
    const chunkDomain = new Map(chunks.map((c) => [c.id, c.primaryDomain]))

    const sessions: RawSessionStat[] = studySessions.map((session) => {
      const windowEnd = session.endedAt ?? new Date()
      const tallies = new Map<string, DomainTally>()
      for (const response of responses) {
        if (response.createdAt < session.startedAt || response.createdAt > windowEnd) {
          continue
        }
        const domain = response.questionSnapshot.provenance.sourceChunkIds
          .map((id) => chunkDomain.get(id))
          .find((d) => d !== undefined)
        if (domain === undefined) {
          continue
        }
        const tally = tallies.get(domain) ?? { correct: 0, total: 0 }
        tally.total += 1
        if (response.correct) {
          tally.correct += 1
        }
        tallies.set(domain, tally)
      }
      return {
        sessionId: session.id,
        kind: session.kind,
        status: session.status,
        endedAt: session.endedAt,
        domains: [...tallies.entries()].map(([domain, tally]) => ({
          domain,
          accuracy: computeAccuracy(tally),
        })),
      }
    })

    const mocks = await em.find(
      MockExam,
      { userCertification: enrollmentId, status: { $in: ['submitted', 'expired'] } },
      { orderBy: { updatedAt: 'DESC' } },
    )
    const mockExams: RawMockStat[] = mocks.map((mock) => ({
      mockExamId: mock.id,
      score: mock.score,
      submittedAt: mock.status === 'submitted' ? mock.updatedAt : null,
    }))

    return { sessions, mockExams }
  }
}
