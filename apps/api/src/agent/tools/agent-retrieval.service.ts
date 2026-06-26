import { EntityManager } from '@mikro-orm/core'
import { Injectable } from '@nestjs/common'
import type { RetrievalPort, RetrievedChunk } from './agent-tools.types'

type ChunkRow = {
  id: string
  text: string
  primary_domain: string
  source_url: string
  similarity: number
}

const toRetrievedChunk = (row: ChunkRow): RetrievedChunk => ({
  id: row.id,
  text: row.text,
  similarity: Number(row.similarity),
  sourceUrl: row.source_url,
  primaryDomain: row.primary_domain,
})

@Injectable()
export class AgentRetrievalService implements RetrievalPort {
  constructor(private readonly em: EntityManager) {}

  async searchChunks(
    certificationId: string,
    queryEmbedding: number[],
    options: { threshold: number; limit: number },
  ): Promise<RetrievedChunk[]> {
    const vectorLiteral = `[${queryEmbedding.join(',')}]`
    const rows = await this.em.getConnection().execute<ChunkRow[]>(
      `
      SELECT cc.id, cc.text, cc.primary_domain, cs.url AS source_url,
             1 - (cc.embedding <=> ?::vector) AS similarity
      FROM content_chunks cc
      JOIN content_sources cs ON cs.id = cc.content_source_id
      WHERE cc.certification_id = ?
        AND cc.state = 'active'
        AND 1 - (cc.embedding <=> ?::vector) >= ?
      ORDER BY cc.embedding <=> ?::vector
      LIMIT ?
      `,
      [
        vectorLiteral,
        certificationId,
        vectorLiteral,
        options.threshold,
        vectorLiteral,
        options.limit,
      ],
    )
    return rows.map(toRetrievedChunk)
  }

  async getChunksByIds(certificationId: string, ids: string[]): Promise<RetrievedChunk[]> {
    if (ids.length === 0) {
      return []
    }
    const placeholders = ids.map(() => '?').join(', ')
    const rows = await this.em.getConnection().execute<ChunkRow[]>(
      `
      SELECT cc.id, cc.text, cc.primary_domain, cs.url AS source_url, 1 AS similarity
      FROM content_chunks cc
      JOIN content_sources cs ON cs.id = cc.content_source_id
      WHERE cc.certification_id = ?
        AND cc.id IN (${placeholders})
      `,
      [certificationId, ...ids],
    )
    return rows.map(toRetrievedChunk)
  }
}
