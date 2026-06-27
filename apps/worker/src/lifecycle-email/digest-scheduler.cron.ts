import { EntityManager } from '@mikro-orm/core'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron, CronExpression } from '@nestjs/schedule'
import { DIGEST_SEND_HOUR_DEFAULT, DIGEST_SEND_WEEKDAY_DEFAULT } from '@readion/shared'
import type { WorkerEnvConfig } from '../config/env.schema'
import { isDigestDue } from './digest-window'
import { LIFECYCLE_API_CLIENT, LifecycleApiClient } from './lifecycle-api.client'

interface DigestCandidateRow {
  id: string
  display_timezone: string
  last_digest_sent_at: string | null
}

@Injectable()
export class DigestSchedulerCron {
  private readonly logger = new Logger(DigestSchedulerCron.name)

  constructor(
    private readonly em: EntityManager,
    private readonly config: ConfigService<WorkerEnvConfig>,
    @Inject(LIFECYCLE_API_CLIENT) private readonly client: LifecycleApiClient,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async scheduleWeeklyDigests(now = new Date()): Promise<void> {
    const sendWeekday = Number(
      this.config.get('DIGEST_SEND_WEEKDAY') ?? DIGEST_SEND_WEEKDAY_DEFAULT,
    )
    const sendHour = Number(this.config.get('DIGEST_SEND_HOUR') ?? DIGEST_SEND_HOUR_DEFAULT)

    const rows: DigestCandidateRow[] = await this.em
      .fork()
      .getConnection()
      .execute<DigestCandidateRow[]>(
        `SELECT id, display_timezone, last_digest_sent_at
         FROM users
         WHERE digest_opt_out = false AND deleted_at IS NULL`,
      )

    const dueUserIds = rows
      .filter((row: DigestCandidateRow) =>
        isDigestDue({
          now,
          displayTimezone: row.display_timezone,
          digestOptOut: false,
          lastDigestSentAt: row.last_digest_sent_at ? new Date(row.last_digest_sent_at) : null,
          sendWeekday,
          sendHour,
        }),
      )
      .map((row: DigestCandidateRow) => row.id)

    if (dueUserIds.length === 0) {
      return
    }

    await this.client.triggerDigest(dueUserIds)
    this.logger.log(`Triggered weekly digest for ${dueUserIds.length} user(s)`)
  }
}
