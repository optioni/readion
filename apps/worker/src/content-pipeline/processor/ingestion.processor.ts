import { Logger } from '@nestjs/common'
import type { Job } from 'bullmq'
import { BaseProcessor } from '../../queue/base.processor'
import { IngestionService } from './ingestion.service'

export interface IngestionJobData {
  contentSourceId: string
  domains: string[]
}

export class IngestionProcessor extends BaseProcessor {
  protected readonly logger: Logger

  constructor(
    queueName: string,
    private readonly ingestionService: IngestionService,
  ) {
    super()
    this.logger = new Logger(`IngestionProcessor:${queueName}`)
  }

  async handle(job: Job<IngestionJobData>): Promise<void> {
    await this.ingestionService.ingest(job.data.contentSourceId, job.data.domains)
  }
}
