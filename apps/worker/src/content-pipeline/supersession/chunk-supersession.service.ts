import { EntityManager } from '@mikro-orm/core'
import { Inject, Injectable } from '@nestjs/common'
import { evictByChunkId } from '@readion/shared'
import type Redis from 'ioredis'
import { REDIS_CLIENT } from '../../redis/redis.module'

@Injectable()
export class ChunkSupersessionService {
  constructor(
    private readonly em: EntityManager,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async supersede(chunkId: string, supersededById: string | null, now: Date): Promise<void> {
    const em = this.em.fork()
    await em.getConnection().execute(
      `UPDATE content_chunks
       SET state = 'superseded', superseded_by_id = ?, superseded_at = ?
       WHERE id = ? AND state = 'active'`,
      [supersededById, now.toISOString(), chunkId],
    )
    await evictByChunkId(this.redis, chunkId)
  }

  async supersedeAll(sourceId: string, now: Date): Promise<void> {
    const em = this.em.fork()
    const rows = await em
      .getConnection()
      .execute<{ id: string }[]>(
        `SELECT id FROM content_chunks WHERE content_source_id = ? AND state = 'active'`,
        [sourceId],
      )
    for (const row of rows) {
      await this.supersede(row.id, null, now)
    }
  }
}
