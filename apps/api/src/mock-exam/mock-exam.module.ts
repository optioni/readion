import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { MOCK_EXAM_GENERATION_QUEUE } from '@readion/shared'
import { QuizModule } from '../quiz/quiz.module'
import { EnrollmentMockExamController } from './mock-exam.controller'
import { MockExamGenerationProcessor } from './mock-exam-generation.processor'
import { MockExamGenerationService } from './mock-exam-generation.service'
import { MockExamScorer } from './mock-exam-scorer'
import { MockExamService } from './mock-exam.service'

@Module({
  imports: [BullModule.registerQueue({ name: MOCK_EXAM_GENERATION_QUEUE }), QuizModule],
  controllers: [EnrollmentMockExamController],
  providers: [MockExamScorer, MockExamGenerationService, MockExamGenerationProcessor, MockExamService],
  exports: [MockExamScorer, MockExamGenerationService, MockExamGenerationProcessor],
})
export class MockExamModule {}
