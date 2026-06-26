import { Module } from '@nestjs/common'
import { GroundingModule } from '../grounding/grounding.module'
import { LlmModule } from '../llm/llm.module'
import { QuizController } from './quiz.controller'
import { QuizService } from './quiz.service'

@Module({
  imports: [GroundingModule, LlmModule],
  controllers: [QuizController],
  providers: [QuizService],
  exports: [QuizService],
})
export class QuizModule {}
