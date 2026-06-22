import { WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import type { Job } from 'bullmq'

export abstract class BaseProcessor extends WorkerHost {
  protected abstract readonly logger: Logger

  abstract handle(job: Job): Promise<unknown>

  async process(job: Job): Promise<unknown> {
    this.logger.log(`started job ${job.id} on queue ${job.queueName}`)
    try {
      const result = await this.handle(job)
      this.logger.log(`completed job ${job.id} on queue ${job.queueName}`)
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.logger.error(`failed job ${job.id}: ${message}`)
      throw err
    }
  }
}
