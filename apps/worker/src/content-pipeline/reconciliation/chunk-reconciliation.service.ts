import { EntityManager } from '@mikro-orm/core'
import { Injectable } from '@nestjs/common'
import type { ChunkMetadata } from '@readion/shared'
import { ChunkSupersessionService } from '../supersession/chunk-supersession.service'

interface ExistingChunk {
  id: string
  content_hash: string
  metadata: ChunkMetadata | string
}

@Injectable()
export class ChunkReconciliationService {
  constructor(
    private readonly em: EntityManager,
    private readonly supersession: ChunkSupersessionService,
  ) {}

  async reconcile(sourceId: string, newHashes: string[], now = new Date()): Promise<void> {
    const em = this.em.fork()
    const existingChunks = await em.getConnection().execute<ExistingChunk[]>(
      `SELECT id, content_hash, metadata FROM content_chunks
       WHERE content_source_id = ? AND state = 'active'`,
      [sourceId],
    )

    const newHashSet = new Set(newHashes)
    const disappearedChunks = existingChunks.filter(
      (c: ExistingChunk) => !newHashSet.has(c.content_hash),
    )

    if (disappearedChunks.length === 0) return

    // Fetch the new active chunks (just inserted by upsert) for lineage resolution
    const newChunks =
      newHashes.length > 0
        ? await em.getConnection().execute<ExistingChunk[]>(
            `SELECT id, content_hash, metadata FROM content_chunks
             WHERE content_source_id = ? AND content_hash IN (${newHashes.map(() => '?').join(', ')}) AND state = 'active'`,
            [sourceId, ...newHashes],
          )
        : []

    for (const disappeared of disappearedChunks) {
      const successorId = this.findSingleOverlappingSuccessor(disappeared, newChunks)
      await this.supersession.supersede(disappeared.id, successorId, now)
    }
  }

  private findSingleOverlappingSuccessor(
    disappeared: ExistingChunk,
    newChunks: ExistingChunk[],
  ): string | null {
    const oldMeta = this.parseMeta(disappeared.metadata)
    const candidates = newChunks.filter((c) => this.overlaps(oldMeta, this.parseMeta(c.metadata)))
    return candidates.length === 1 ? candidates[0]!.id : null
  }

  private overlaps(a: ChunkMetadata, b: ChunkMetadata): boolean {
    const aKeys = Object.keys(a).filter((k) => a[k] != null)
    if (aKeys.length === 0) return false
    return aKeys.some((k) => b[k] != null && b[k] === a[k])
  }

  private parseMeta(raw: ChunkMetadata | string): ChunkMetadata {
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as ChunkMetadata
      } catch {
        return {}
      }
    }
    return raw ?? {}
  }
}
