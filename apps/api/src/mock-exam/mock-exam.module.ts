import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { MOCK_EXAM_GENERATION_QUEUE } from '@readion/shared'
import { QuizModule } from '../quiz/quiz.module'
import { MockExamGenerationProcessor } from './mock-exam-generation.processor'
import { MockExamGenerationService } from './mock-exam-generation.service'
import { MockExamScorer } from './mock-exam-scorer'

@Module({
  imports: [BullModule.registerQueue({ name: MOCK_EXAM_GENERATION_QUEUE }), QuizModule],
  providers: [MockExamScorer, MockExamGenerationService, MockExamGenerationProcessor],
  exports: [MockExamScorer, MockExamGenerationService, MockExamGenerationProcessor],
})
export class MockExamModule {}
