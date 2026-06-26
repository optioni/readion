import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { MOCK_EXAM_GENERATION_QUEUE } from '@readion/shared'

// Both mock-exam and diagnostic enqueue onto the same generation queue. Registering
// it here once and exporting it keeps them pointed at a single Queue instance —
// registering per-module would create distinct instances bound to the same Redis queue.
@Module({
  imports: [BullModule.registerQueue({ name: MOCK_EXAM_GENERATION_QUEUE })],
  exports: [BullModule],
})
export class MockExamQueueModule {}
