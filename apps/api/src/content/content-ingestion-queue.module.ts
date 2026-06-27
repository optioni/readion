import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { contentSourceTypes, ingestionQueueName } from '@readion/shared'

const queueRegistrations = contentSourceTypes.map((type) =>
  BullModule.registerQueue({ name: ingestionQueueName(type) }),
)

@Module({
  imports: [...queueRegistrations],
  exports: [BullModule],
})
export class ContentIngestionQueueModule {}
