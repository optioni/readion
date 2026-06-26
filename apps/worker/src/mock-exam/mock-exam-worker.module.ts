import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { MOCK_EXAM_GENERATION_QUEUE } from '@readion/shared'
import { LlmModule } from '../llm/llm.module'
import { MockExamGenerationProcessor } from './mock-exam-generation.processor'
import { MockExamWorkerGenerationService } from './mock-exam-worker-generation.service'

@Module({
  imports: [BullModule.registerQueue({ name: MOCK_EXAM_GENERATION_QUEUE }), LlmModule],
  providers: [MockExamGenerationProcessor, MockExamWorkerGenerationService],
})
export class MockExamWorkerModule {}
