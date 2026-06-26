import { Processor } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import type { MockExamGenerationJobPayload } from '@readion/shared'
import { MOCK_EXAM_GENERATION_QUEUE } from '@readion/shared'
import type { Job } from 'bullmq'
import { BaseProcessor } from '../queue/base.processor'
import { MockExamWorkerGenerationService } from './mock-exam-worker-generation.service'

@Processor(MOCK_EXAM_GENERATION_QUEUE)
export class MockExamGenerationProcessor extends BaseProcessor {
  protected readonly logger = new Logger(MockExamGenerationProcessor.name)

  constructor(private readonly generator: MockExamWorkerGenerationService) {
    super()
  }

  async handle(job: Job<MockExamGenerationJobPayload>): Promise<void> {
    const { attemptId } = job.data
    await this.generator.generateAndStamp(attemptId)
  }
}
