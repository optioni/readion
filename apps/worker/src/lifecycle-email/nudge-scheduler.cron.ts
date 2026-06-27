import { EntityManager } from '@mikro-orm/core'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron, CronExpression } from '@nestjs/schedule'
import { NUDGE_ACTIVITY_LULL_DAYS_DEFAULT } from '@readion/shared'
import type { WorkerEnvConfig } from '../config/env.schema'
import { LIFECYCLE_API_CLIENT, LifecycleApiClient } from './lifecycle-api.client'
import { isNudgeLullCandidate } from './nudge-lull'

interface NudgeCandidateRow {
  id: string
  last_activity: string | null
}

@Injectable()
export class NudgeSchedulerCron {
  private readonly logger = new Logger(NudgeSchedulerCron.name)

  constructor(
    private readonly em: EntityManager,
    private readonly config: ConfigService<WorkerEnvConfig>,
    @Inject(LIFECYCLE_API_CLIENT) private readonly client: LifecycleApiClient,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async scheduleExamNudges(now = new Date()): Promise<void> {
    const lullDays = Number(
      this.config.get('NUDGE_ACTIVITY_LULL_DAYS') ?? NUDGE_ACTIVITY_LULL_DAYS_DEFAULT,
    )

    // `exam_outcome_response IS NULL` is a coarse allowance proxy; the API enforces the
    // precise NUDGE_MAX_FOLLOWUPS and readiness gate before any send.
    const rows: NudgeCandidateRow[] = await this.em
      .fork()
      .getConnection()
      .execute<NudgeCandidateRow[]>(
        `SELECT uc.id,
                GREATEST(
                  (SELECT MAX(started_at) FROM study_sessions WHERE user_certification_id = uc.id),
                  (SELECT MAX(ended_at) FROM study_sessions WHERE user_certification_id = uc.id),
                  (SELECT MAX(created_at) FROM quiz_responses WHERE user_certification_id = uc.id)
                ) AS last_activity
         FROM user_certifications uc
         WHERE uc.status = 'active' AND uc.exam_outcome_response IS NULL`,
      )

    const candidateIds = rows
      .filter((row) =>
        isNudgeLullCandidate({
          now,
          lastActivityAt: row.last_activity ? new Date(row.last_activity) : null,
          lullDays,
        }),
      )
      .map((row) => row.id)

    if (candidateIds.length === 0) {
      return
    }

    await this.client.triggerNudge(candidateIds)
    this.logger.log(`Triggered exam nudge for ${candidateIds.length} enrollment(s)`)
  }
}
