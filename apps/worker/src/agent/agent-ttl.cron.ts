import { EntityManager } from '@mikro-orm/core'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron, CronExpression } from '@nestjs/schedule'
import { InjectMetric } from '@willsoto/nestjs-prometheus'
import type { Gauge } from 'prom-client'
import type { WorkerEnvConfig } from '../config/env.schema'

export const ACTIVE_STANDALONE_CONVERSATIONS_GAUGE = 'readion_active_standalone_conversations'

@Injectable()
export class AgentTtlCron {
  private readonly logger = new Logger(AgentTtlCron.name)

  constructor(
    private readonly em: EntityManager,
    @InjectMetric(ACTIVE_STANDALONE_CONVERSATIONS_GAUGE)
    private readonly activeStandaloneGauge: Gauge,
    private readonly config: ConfigService<WorkerEnvConfig>,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupStaleStandaloneConversations(now = new Date()): Promise<void> {
    const ttlHours = 4
    const cutoff = new Date(now.getTime() - ttlHours * 60 * 60 * 1000)
    const conn = this.em.fork().getConnection()

    const result = await conn.execute<{ id: string }[]>(
      `UPDATE agent_conversations
       SET deleted_at = ?
       WHERE mode = 'standalone' AND deleted_at IS NULL AND last_activity_at < ?
       RETURNING id`,
      [now.toISOString(), cutoff.toISOString()],
    )

    if (result.length > 0) {
      this.logger.log(`Soft-deleted ${result.length} stale standalone conversation(s)`)
    }

    await this.refreshGauge()
  }

  private async refreshGauge(): Promise<void> {
    const conn = this.em.fork().getConnection()
    const rows = await conn.execute<{ count: string }[]>(
      `SELECT COUNT(*) as count FROM agent_conversations WHERE mode = 'standalone' AND deleted_at IS NULL`,
    )
    const count = Number.parseInt(rows[0]!.count, 10)
    this.activeStandaloneGauge.set(count)
  }
}
