import { EntityManager } from '@mikro-orm/core'
import { Injectable, NotFoundException } from '@nestjs/common'
import { ContentChunk, QuizResponse, UserCertification } from '@readion/db'
import type { DomainScoreInput } from './domain-scoring'
import { computeDomainScore } from './domain-scoring'

export type WeakAreaDto = {
  id: string
  domain: string
  score: number
  accuracy: number
  meanConfidence: number
  responseCount: number
}

type WeakAreaRow = { id: string }

const rankComparator = (a: WeakAreaDto, b: WeakAreaDto): number => {
  if (a.score !== b.score) return a.score - b.score
  if (a.responseCount !== b.responseCount) return b.responseCount - a.responseCount
  return a.domain.localeCompare(b.domain)
}

@Injectable()
export class WeakAreasService {
  constructor(private readonly em: EntityManager) {}

  async recompute(userCertificationId: string): Promise<void> {
    const em = this.em.fork()

    const responses = await em.find(QuizResponse, {
      userCertification: userCertificationId,
    })

    const allChunkIds = [
      ...new Set(responses.flatMap((r) => r.questionSnapshot.provenance.sourceChunkIds)),
    ]

    const chunks =
      allChunkIds.length > 0 ? await em.find(ContentChunk, { id: { $in: allChunkIds } }) : []

    const chunkDomainMap = new Map(chunks.map((c) => [c.id, c.primaryDomain]))

    const domainInputs = new Map<string, DomainScoreInput[]>()
    for (const response of responses) {
      const chunkIds = response.questionSnapshot.provenance.sourceChunkIds
      // Attribution uses the first resolvable chunk's primaryDomain per design (single-domain per response).
      const domain = chunkIds.map((id) => chunkDomainMap.get(id)).find((d) => d !== undefined)
      if (domain === undefined) continue
      const entry = domainInputs.get(domain) ?? []
      entry.push({ correct: response.correct, confidence: response.confidence })
      domainInputs.set(domain, entry)
    }

    const conn = em.getConnection()

    if (domainInputs.size > 0) {
      for (const [domain, inputs] of domainInputs) {
        const computed = computeDomainScore(inputs)
        await conn.execute(
          `INSERT INTO weak_areas
            (id, user_certification_id, domain, score, accuracy, mean_confidence, response_count, created_at, updated_at)
           VALUES (gen_random_uuid(), ?, ?, ?, ?, ?, ?, now(), now())
           ON CONFLICT (user_certification_id, domain)
           DO UPDATE SET
             score = EXCLUDED.score,
             accuracy = EXCLUDED.accuracy,
             mean_confidence = EXCLUDED.mean_confidence,
             response_count = EXCLUDED.response_count,
             updated_at = now()`,
          [
            userCertificationId,
            domain,
            computed.score,
            computed.accuracy,
            computed.meanConfidence,
            computed.responseCount,
          ],
        )
      }

      const domainList = [...domainInputs.keys()]
      const placeholders = domainList.map(() => '?').join(', ')
      await conn.execute(
        `DELETE FROM weak_areas WHERE user_certification_id = ? AND domain NOT IN (${placeholders})`,
        [userCertificationId, ...domainList],
      )
    } else {
      await conn.execute(`DELETE FROM weak_areas WHERE user_certification_id = ?`, [
        userCertificationId,
      ])
    }
  }

  async listWithRecompute(userId: string, userCertificationId: string): Promise<WeakAreaDto[]> {
    const em = this.em.fork()
    const conn = em.getConnection()

    const enrollment = await em.findOne(UserCertification, {
      id: userCertificationId,
      user: userId,
    })
    if (enrollment === null) {
      throw new NotFoundException('Enrollment not found')
    }

    await this.recompute(userCertificationId)

    const rows = await conn.execute<(WeakAreaRow & WeakAreaDto)[]>(
      `SELECT id, domain, score, accuracy, mean_confidence AS "meanConfidence", response_count AS "responseCount"
       FROM weak_areas WHERE user_certification_id = ?`,
      [userCertificationId],
    )

    return rows.sort(rankComparator)
  }

  async listForEnrollment(userId: string, userCertificationId: string): Promise<WeakAreaDto[]> {
    const em = this.em.fork()
    const conn = em.getConnection()

    const enrollment = await em.findOne(UserCertification, {
      id: userCertificationId,
      user: userId,
    })
    if (enrollment === null) {
      throw new NotFoundException('Enrollment not found')
    }

    const rows = await conn.execute<(WeakAreaRow & WeakAreaDto)[]>(
      `SELECT id, domain, score, accuracy, mean_confidence AS "meanConfidence", response_count AS "responseCount"
       FROM weak_areas WHERE user_certification_id = ?`,
      [userCertificationId],
    )

    return rows.sort(rankComparator)
  }
}
