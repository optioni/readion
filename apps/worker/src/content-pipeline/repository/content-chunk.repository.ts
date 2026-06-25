import { EntityManager } from '@mikro-orm/core'
import { Injectable } from '@nestjs/common'
import type { ChunkMetadata, DomainTag } from '@readion/shared'

export interface ChunkSearchResult {
  id: string
  contentSourceId: string
  certificationId: string
  text: string
  contentHash: string
  embedding: number[] | null
  domainTags: DomainTag[]
  primaryDomain: string
  metadata: ChunkMetadata
  sourceUrl: string
}

export interface UpsertChunkInput {
  contentSourceId: string
  certificationId: string
  text: string
  contentHash: string
  embedding: number[]
  domainTags: DomainTag[]
  primaryDomain: string
  metadata: ChunkMetadata
}

@Injectable()
export class ContentChunkRepository {
  constructor(private readonly em: EntityManager) {}

  async upsertChunk(input: UpsertChunkInput): Promise<void> {
    const conn = this.em.getConnection()
    await conn.execute(
      `
      INSERT INTO content_chunks
        (id, content_source_id, certification_id, text, content_hash, embedding,
         domain_tags, primary_domain, metadata, created_at, updated_at)
      VALUES
        (gen_random_uuid(), ?, ?, ?, ?, ?::vector, ?, ?, ?, NOW(), NOW())
      ON CONFLICT (content_source_id, content_hash)
      DO UPDATE SET
        text = EXCLUDED.text,
        embedding = EXCLUDED.embedding,
        domain_tags = EXCLUDED.domain_tags,
        primary_domain = EXCLUDED.primary_domain,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      `,
      [
        input.contentSourceId,
        input.certificationId,
        input.text,
        input.contentHash,
        `[${input.embedding.join(',')}]`,
        JSON.stringify(input.domainTags),
        input.primaryDomain,
        JSON.stringify(input.metadata),
      ],
    )
  }

  async upsertMany(inputs: UpsertChunkInput[]): Promise<void> {
    for (const input of inputs) {
      await this.upsertChunk(input)
    }
  }

  async findByCertification(
    certificationId: string,
    queryEmbedding: number[],
    options: {
      threshold: number
      limit?: number
      domains?: string[]
    },
  ): Promise<ChunkSearchResult[]> {
    const { threshold, limit = 20, domains } = options
    const vectorLiteral = `[${queryEmbedding.join(',')}]`

    let domainFilter = ''
    // params order: vectorLiteral, certificationId, vectorLiteral, threshold, [domain...], vectorLiteral, limit
    const params: unknown[] = [vectorLiteral, certificationId, vectorLiteral, threshold]

    if (domains && domains.length > 0) {
      const domainPlaceholders = domains.map(() => '?').join(', ')
      domainFilter = `AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(cc.domain_tags) AS tag
        WHERE (tag->>'domain') IN (${domainPlaceholders})
      )`
      params.push(...domains)
    }

    params.push(vectorLiteral, limit)

    type ChunkRow = {
      id: string
      content_source_id: string
      certification_id: string
      text: string
      content_hash: string
      embedding: string
      domain_tags: string
      primary_domain: string
      metadata: string
      created_at: string
      updated_at: string
      similarity: number
      source_url: string
    }
    const rows = await this.em.getConnection().execute<ChunkRow[]>(
      `
      SELECT cc.*, cs.url AS source_url, 1 - (cc.embedding <=> ?::vector) AS similarity
      FROM content_chunks cc
      JOIN content_sources cs ON cs.id = cc.content_source_id
      WHERE cc.certification_id = ?
        AND 1 - (cc.embedding <=> ?::vector) >= ?
        ${domainFilter}
      ORDER BY cc.embedding <=> ?::vector
      LIMIT ?
      `,
      params,
    )

    return rows.map((row: ChunkRow): ChunkSearchResult => ({
      id: row.id,
      contentSourceId: row.content_source_id,
      certificationId: row.certification_id,
      text: row.text,
      contentHash: row.content_hash,
      embedding:
        typeof row.embedding === 'string'
          ? (JSON.parse(row.embedding) as number[])
          : (row.embedding as unknown as number[] | null),
      domainTags: (Array.isArray(row.domain_tags)
        ? row.domain_tags
        : JSON.parse(row.domain_tags)) as DomainTag[],
      primaryDomain: row.primary_domain,
      metadata: (typeof row.metadata === 'object' && row.metadata !== null
        ? row.metadata
        : JSON.parse(row.metadata)) as ChunkMetadata,
      sourceUrl: row.source_url,
    }))
  }
}
