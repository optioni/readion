import { EntityManager } from '@mikro-orm/core'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron, CronExpression } from '@nestjs/schedule'
import { InjectMetric } from '@willsoto/nestjs-prometheus'
import type { Gauge } from 'prom-client'
import type { WorkerEnvConfig } from '../config/env.schema'

export const ACTIVE_SESSIONS_GAUGE = 'readion_active_sessions'

@Injectable()
export class SessionAbandonmentCron {
  private readonly logger = new Logger(SessionAbandonmentCron.name)

  constructor(
    private readonly em: EntityManager,
    @InjectMetric(ACTIVE_SESSIONS_GAUGE) private readonly activeSessionsGauge: Gauge,
    private readonly config: ConfigService<WorkerEnvConfig>,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async abandonStaleSessions(now = new Date()): Promise<void> {
    const thresholdHours = this.config.get('SESSION_ABANDONMENT_THRESHOLD_HOURS') ?? 24
    const cutoff = new Date(now.getTime() - thresholdHours * 60 * 60 * 1000)
    const conn = this.em.fork().getConnection()

    const result = await conn.execute<{ id: string }[]>(
      `UPDATE study_sessions
       SET status = 'abandoned', ended_at = ?
       WHERE status = 'active' AND started_at < ?
       RETURNING id`,
      [now.toISOString(), cutoff.toISOString()],
    )

    if (result.length > 0) {
      this.logger.log(`Abandoned ${result.length} stale session(s)`)
    }

    await this.refreshGauge()
  }

  private async refreshGauge(): Promise<void> {
    const conn = this.em.fork().getConnection()
    const rows = await conn.execute<{ count: string }[]>(
      `SELECT COUNT(*) as count FROM study_sessions WHERE status = 'active'`,
    )
    const count = Number.parseInt(rows[0]!.count, 10)
    this.activeSessionsGauge.set(count)
  }
}
