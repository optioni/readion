import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { DbModule } from '@readion/db'
import { WorkerConfigModule } from './config/config.module'
import { WorkerObservabilityModule } from './observability/observability.module'
import { QueueModule } from './queue/queue.module'
import { RedisModule } from './redis/redis.module'
import { ScrapperModule } from './scrapper/scrapper.module'
import { UsersModule } from './users/users.module'

@Module({
  imports: [
    WorkerConfigModule,
    WorkerObservabilityModule.forRoot(),
    DbModule,
    RedisModule,
    QueueModule,
    ScheduleModule.forRoot(),
    ScrapperModule,
    UsersModule,
  ],
})
export class AppModule {}
