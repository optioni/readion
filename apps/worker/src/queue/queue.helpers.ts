import { BullModule } from '@nestjs/bullmq'
import type { JobOptionsOverrides } from './queue.defaults'
import { buildDefaultJobOptions } from './queue.defaults'

export function registerSourceQueue(name: string, overrides?: JobOptionsOverrides) {
  return BullModule.registerQueue({
    name,
    defaultJobOptions: buildDefaultJobOptions(overrides),
  })
}
