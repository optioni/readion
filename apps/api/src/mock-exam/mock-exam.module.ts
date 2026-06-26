import { Module } from '@nestjs/common'
import { QuizModule } from '../quiz/quiz.module'
import { MockExamGenerationService } from './mock-exam-generation.service'
import { MockExamScorer } from './mock-exam-scorer'

@Module({
  imports: [QuizModule],
  providers: [MockExamScorer, MockExamGenerationService],
  exports: [MockExamScorer, MockExamGenerationService],
})
export class MockExamModule {}
