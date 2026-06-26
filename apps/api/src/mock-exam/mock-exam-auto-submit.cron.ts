import { EntityManager } from '@mikro-orm/core'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron, CronExpression } from '@nestjs/schedule'
import { MockExam } from '@readion/db'
import type { EnvConfig } from '../config/env.schema'
import { MockExamService } from './mock-exam.service'

@Injectable()
export class MockExamAutoSubmitCron {
  private readonly logger = new Logger(MockExamAutoSubmitCron.name)

  constructor(
    private readonly em: EntityManager,
    private readonly service: MockExamService,
    private readonly config: ConfigService<EnvConfig>,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sweep(now = new Date()): Promise<void> {
    const graceSeconds = this.config.get('MOCK_EXAM_AUTO_SUBMIT_GRACE_SECONDS') ?? 120
    const cutoff = new Date(now.getTime() - graceSeconds * 1000)

    const em = this.em.fork()
    const attempts = await em.find(
      MockExam,
      {
        status: 'in_progress',
        deadline: { $lt: cutoff },
      },
      { populate: ['userCertification', 'userCertification.certification'] },
    )

    for (const attempt of attempts) {
      try {
        await this.service.finalizeAttempt(em, attempt, 'expired')
        this.logger.log(`Auto-expired mock exam attempt ${attempt.id}`)
      } catch (err) {
        this.logger.error(`Failed to auto-expire attempt ${attempt.id}: ${String(err)}`)
      }
    }
  }
}
