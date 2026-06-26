import { EntityManager } from '@mikro-orm/core'
import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { MockExam } from '@readion/db'
import type { MockExamGenerationJobPayload } from '@readion/shared'
import { MOCK_EXAM_GENERATION_QUEUE } from '@readion/shared'
import type { Job } from 'bullmq'
import { MockExamGenerationService } from './mock-exam-generation.service'

@Processor(MOCK_EXAM_GENERATION_QUEUE)
export class MockExamGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(MockExamGenerationProcessor.name)

  constructor(
    private readonly generationService: MockExamGenerationService,
    private readonly em: EntityManager,
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
    await this.stampDeadlineIfComplete(attemptId, shortfall)

    this.logger.log(`Generation complete for attempt ${attemptId}`)
  }

  private async stampDeadlineIfComplete(attemptId: string, shortfall: number): Promise<void> {
    const em = this.em.fork()
    const attempt = await em.findOne(
      MockExam,
      { id: attemptId },
      { populate: ['userCertification', 'userCertification.certification'] },
    )

    if (!attempt) return

    const cert = attempt.userCertification.certification
    const allSlotsProcessed = attempt.questions.length + shortfall === cert.questionCount

    if (allSlotsProcessed && attempt.startedAt === null) {
      const startedAt = new Date()
      attempt.startedAt = startedAt
      attempt.deadline = new Date(startedAt.getTime() + cert.timeLimitMinutes * 60 * 1000)
      await em.flush()
    }
  }
}
