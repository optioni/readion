import { Module } from '@nestjs/common'
import { contentSourceTypes } from '@readion/shared'
import { registerSourceQueue } from '../../queue/queue.helpers'

export function ingestionQueueName(type: string): string {
  return `ingestion-${type}`
}

const queueRegistrations = contentSourceTypes.map((type) =>
  registerSourceQueue(ingestionQueueName(type)),
)

@Module({
  imports: [...queueRegistrations],
  exports: [...queueRegistrations],
})
export class ContentQueuesModule {}
