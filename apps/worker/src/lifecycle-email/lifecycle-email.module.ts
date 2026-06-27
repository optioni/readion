import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { WorkerEnvConfig } from '../config/env.schema'
import { DigestSchedulerCron } from './digest-scheduler.cron'
import { LIFECYCLE_API_CLIENT, LifecycleApiClient } from './lifecycle-api.client'
import { NudgeSchedulerCron } from './nudge-scheduler.cron'

@Module({
  providers: [
    DigestSchedulerCron,
    NudgeSchedulerCron,
    {
      provide: LIFECYCLE_API_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<WorkerEnvConfig, true>) =>
        new LifecycleApiClient(
          config.getOrThrow('INTERNAL_API_BASE_URL'),
          config.getOrThrow('INTERNAL_API_SECRET'),
        ),
    },
  ],
})
export class LifecycleEmailModule {}
