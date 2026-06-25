import { EntityManager } from '@mikro-orm/core'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron, CronExpression } from '@nestjs/schedule'
import type { WorkerEnvConfig } from '../../config/env.schema'

const DAY_MS = 24 * 60 * 60 * 1000
export const SUPERSEDED_CHUNK_CLEANUP_CRON = 'superseded-chunk-cleanup'

@Injectable()
export class SupersededChunkCleanupCron {
  private readonly logger = new Logger(SupersededChunkCleanupCron.name)

  constructor(
    private readonly em: EntityManager,
    private readonly config: ConfigService<WorkerEnvConfig>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM, { name: SUPERSEDED_CHUNK_CLEANUP_CRON })
  async cleanupSupersededChunks(now = new Date()): Promise<void> {
    const retentionDays = this.config.get('SUPERSEDED_CHUNK_RETENTION_DAYS') ?? 30
    const cutoff = new Date(now.getTime() - retentionDays * DAY_MS)

    const em = this.em.fork()
    const result = await em.getConnection().execute<{ id: string }[]>(
      `DELETE FROM content_chunks
       WHERE state = 'superseded'
         AND superseded_at < ?
         AND id NOT IN (${this.retainedDependentSubquery()})
       RETURNING id`,
      [cutoff.toISOString()],
    )

    this.logger.log(`Cleaned up ${result.length} superseded chunks`)
  }

  // Guard seam: returns an SQL subquery for chunk ids still referenced by retained dependents.
  // Initially a no-op (empty set); sessions/mock-exam extend this when their snapshot columns exist.
  protected retainedDependentSubquery(): string {
    return 'SELECT NULL::uuid WHERE FALSE'
  }
}
