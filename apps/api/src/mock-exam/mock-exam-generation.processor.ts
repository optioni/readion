import { EntityManager } from '@mikro-orm/core'
import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { MockExam } from '@readion/db'
import type { MockExamGenerationJobPayload } from '@readion/shared'
import { MOCK_EXAM_GENERATION_QUEUE } from '@readion/shared'
import type { Job } from 'bullmq'
import type { EnvConfig } from '../config/env.schema'
import { MockExamGenerationService } from './mock-exam-generation.service'

// Under NODE_ENV=test the worker stays idle (autorun off): the suite shares one Postgres/Redis
// pair and drives generation deterministically via the harness. A live worker would consume
// jobs enqueued by any spec and write to the shared DB mid-test. process.env is read directly
// because the decorator runs before ConfigModule validates env.
@Processor(MOCK_EXAM_GENERATION_QUEUE, { autorun: process.env.NODE_ENV !== 'test' })
export class MockExamGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(MockExamGenerationProcessor.name)

  constructor(
    private readonly generationService: MockExamGenerationService,
    private readonly em: EntityManager,
    private readonly config: ConfigService<EnvConfig>,
  ) {
    super()
  }

  async process(job: Job<MockExamGenerationJobPayload>): Promise<void> {
    const { attemptId } = job.data
    this.logger.log(`Starting generation for attempt ${attemptId}`)

    const preCheck = this.em.fork()
    const existing = await preCheck.findOne(MockExam, { id: attemptId })
    if (!existing) {
      this.logger.warn(`Attempt ${attemptId} not found, skipping`)
      return
    }
    if (existing.startedAt !== null) {
      this.logger.log(`Attempt ${attemptId} already complete (startedAt set), skipping`)
      return
    }

    const { shortfall } = await this.generationService.generateQuestionsForAttempt(attemptId)
    await this.stampCompletionIfDone(attemptId, shortfall)

    this.logger.log(`Generation complete for attempt ${attemptId}`)
  }

  private async stampCompletionIfDone(attemptId: string, shortfall: number): Promise<void> {
    const em = this.em.fork()
    const attempt = await em.findOne(
      MockExam,
      { id: attemptId },
      { populate: ['userCertification', 'userCertification.certification'] },
    )

    if (!attempt) return

    const cert = attempt.userCertification.certification
    const targetCount =
      attempt.type === 'diagnostic'
        ? (this.config.get('DIAGNOSTIC_QUESTION_COUNT', { infer: true }) ?? 12)
        : cert.questionCount
    const allSlotsProcessed = attempt.questions.length + shortfall === targetCount

    if (allSlotsProcessed && attempt.startedAt === null) {
      attempt.startedAt = new Date()
      if (attempt.type === 'mock') {
        attempt.deadline = new Date(attempt.startedAt.getTime() + cert.timeLimitMinutes * 60 * 1000)
      }
      await em.flush()
    }
  }
}
