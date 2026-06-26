import { Processor } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import type { SessionFillJobPayload } from '@readion/shared'
import { SESSION_FILL_QUEUE } from '@readion/shared'
import type { Job } from 'bullmq'
import { BaseProcessor } from '../queue/base.processor'
import { SessionItemGeneratorService } from './session-item-generator.service'

@Processor(SESSION_FILL_QUEUE)
export class SessionFillProcessor extends BaseProcessor {
  protected readonly logger = new Logger(SessionFillProcessor.name)

  constructor(private readonly generator: SessionItemGeneratorService) {
    super()
  }

  async handle(job: Job<SessionFillJobPayload>): Promise<void> {
    const { sessionId, remainingItems, certificationId, difficulty, contentMix } = job.data

    await this.generator.generateItems(
      sessionId,
      remainingItems,
      certificationId,
      difficulty,
      contentMix,
    )
  }
}
