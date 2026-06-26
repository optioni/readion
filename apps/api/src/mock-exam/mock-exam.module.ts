import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { MOCK_EXAM_GENERATION_QUEUE } from '@readion/shared'
import { QuizModule } from '../quiz/quiz.module'
import { WeakAreasModule } from '../weak-areas/weak-areas.module'
import { EnrollmentMockExamController, MockExamController } from './mock-exam.controller'
import { MockExamService } from './mock-exam.service'
import { MockExamGenerationProcessor } from './mock-exam-generation.processor'
import { MockExamGenerationService } from './mock-exam-generation.service'
import { MockExamScorer } from './mock-exam-scorer'

@Module({
  imports: [
    BullModule.registerQueue({ name: MOCK_EXAM_GENERATION_QUEUE }),
    QuizModule,
    WeakAreasModule,
  ],
  controllers: [EnrollmentMockExamController, MockExamController],
  providers: [
    MockExamScorer,
    MockExamGenerationService,
    MockExamGenerationProcessor,
    MockExamService,
  ],
  exports: [MockExamScorer, MockExamGenerationService, MockExamGenerationProcessor],
})
export class MockExamModule {}
