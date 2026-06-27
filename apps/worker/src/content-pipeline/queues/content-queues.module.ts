import { Module } from '@nestjs/common'
import { contentSourceTypes, ingestionQueueName } from '@readion/shared'
import { registerSourceQueue } from '../../queue/queue.helpers'

export { ingestionQueueName } from '@readion/shared'

const queueRegistrations = contentSourceTypes.map((type) =>
  registerSourceQueue(ingestionQueueName(type)),
)

@Module({
  imports: [...queueRegistrations],
  exports: [...queueRegistrations],
})
export class ContentQueuesModule {}
