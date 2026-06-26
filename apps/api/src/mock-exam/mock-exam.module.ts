import { Module } from '@nestjs/common'
import { QuizModule } from '../quiz/quiz.module'
import { WeakAreasModule } from '../weak-areas/weak-areas.module'
import { EnrollmentMockExamController, MockExamController } from './mock-exam.controller'
import { MockExamService } from './mock-exam.service'
import { MockExamAutoSubmitCron } from './mock-exam-auto-submit.cron'
import { MockExamGenerationProcessor } from './mock-exam-generation.processor'
import { MockExamGenerationService } from './mock-exam-generation.service'
import { MockExamQueueModule } from './mock-exam-queue.module'
import { MockExamScorer } from './mock-exam-scorer'

@Module({
  imports: [MockExamQueueModule, QuizModule, WeakAreasModule],
  controllers: [EnrollmentMockExamController, MockExamController],
  providers: [
    MockExamScorer,
    MockExamGenerationService,
    MockExamGenerationProcessor,
    MockExamService,
    MockExamAutoSubmitCron,
  ],
})
export class MockExamModule {}
