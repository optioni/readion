import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { MOCK_EXAM_GENERATION_QUEUE } from '@readion/shared'
import { QuizModule } from '../quiz/quiz.module'
import { WeakAreasModule } from '../weak-areas/weak-areas.module'
import { MockExamAutoSubmitCron } from './mock-exam-auto-submit.cron'
import { EnrollmentMockExamController, MockExamController } from './mock-exam.controller'
import { MockExamService } from './mock-exam.service'
import { MockExamGenerationProcessor } from './mock-exam-generation.processor'
import { MockExamGenerationService } from './mock-exam-generation.service'
import { MockExamScorer } from './mock-exam-scorer'

@Module({
  imports: [
    BullModule.registerQueue({ name: MOCK_EXAM_GENERATION_QUEUE }),
    ScheduleModule.forRoot(),
    QuizModule,
    WeakAreasModule,
  ],
  controllers: [EnrollmentMockExamController, MockExamController],
  providers: [
    MockExamScorer,
    MockExamGenerationService,
    MockExamGenerationProcessor,
    MockExamService,
    MockExamAutoSubmitCron,
  ],
  exports: [
    MockExamScorer,
    MockExamGenerationService,
    MockExamGenerationProcessor,
    MockExamService,
    MockExamAutoSubmitCron,
  ],
})
export class MockExamModule {}
