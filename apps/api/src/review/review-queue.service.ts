import { EntityManager } from '@mikro-orm/core'
import { Injectable } from '@nestjs/common'
import { ContentChunk, ReviewItem } from '@readion/db'
import { SIMILARITY_THRESHOLD_DEFAULT } from '@readion/shared'
import type { DueItemsProvider, DueTarget } from '../sessions/due-items.port'

export type DueConcept = {
  item: ReviewItem
  anchorChunkId: string
  domain: string
}

@Injectable()
export class ReviewQueueService implements DueItemsProvider {
  constructor(private readonly em: EntityManager) {}

  async getDueConcepts(
    em: EntityManager,
    enrollmentId: string,
    now: Date,
    limit?: number,
  ): Promise<DueConcept[]> {
    const dueItems = await em.find(
      ReviewItem,
      { userCertification: enrollmentId, state: 'active', dueAt: { $lte: now } },
      { orderBy: { dueAt: 'ASC' }, ...(limit !== undefined ? { limit } : {}) },
    )

    const concepts: DueConcept[] = []
    for (const item of dueItems) {
      const resolved = await this.resolveAnchor(em, item)
      if (resolved !== null) {
        concepts.push({ item, anchorChunkId: resolved.anchorChunkId, domain: resolved.domain })
      }
    }
    return concepts
  }

  async getDueTargets(_userId: string, enrollmentId: string): Promise<DueTarget[]> {
    const em = this.em.fork()
    const concepts = await this.getDueConcepts(em, enrollmentId, new Date())
    await em.flush()
    return concepts.map((c) => ({ domain: c.domain, anchorChunkId: c.anchorChunkId }))
  }

  private async resolveAnchor(
    em: EntityManager,
    item: ReviewItem,
  ): Promise<{ anchorChunkId: string; domain: string } | null> {
    let chunk = await em.findOne(ContentChunk, { id: item.anchorChunkId })
    if (chunk === null) return null

    while (chunk !== null && chunk.state === 'superseded' && chunk.supersededById !== null) {
      const next: ContentChunk | null = await em.findOne(ContentChunk, { id: chunk.supersededById })
      if (next === null) break
      chunk = next
    }

    if (chunk !== null && chunk.state === 'active') {
      if (chunk.id !== item.anchorChunkId) {
        item.anchorChunkId = chunk.id
      }
      return { anchorChunkId: chunk.id, domain: chunk.primaryDomain }
    }

    const replacement = await this.retrieveReplacement(em, chunk)
    if (replacement !== null) {
      item.anchorChunkId = replacement.id
      return { anchorChunkId: replacement.id, domain: replacement.primaryDomain }
    }

    return null
  }

  private async retrieveReplacement(
    em: EntityManager,
    superseded: ContentChunk | null,
  ): Promise<{ id: string; primaryDomain: string } | null> {
    if (superseded === null || superseded.embedding === null) return null

    const vectorLiteral = `[${superseded.embedding.join(',')}]`
    type ChunkRow = { id: string; primary_domain: string; similarity: number }

    const rows = await em.getConnection().execute<ChunkRow[]>(
      `
      SELECT id, primary_domain, 1 - (embedding <=> ?::vector) AS similarity
      FROM content_chunks
      WHERE certification_id = ?
        AND state = 'active'
        AND primary_domain = ?
        AND embedding IS NOT NULL
        AND id != ?
      ORDER BY embedding <=> ?::vector
      LIMIT 1
      `,
      [
        vectorLiteral,
        superseded.certificationId,
        superseded.primaryDomain,
        superseded.id,
        vectorLiteral,
      ],
    )

    const top = rows[0]
    if (top === undefined || top.similarity < SIMILARITY_THRESHOLD_DEFAULT) return null
    return { id: top.id, primaryDomain: top.primary_domain }
  }
}
