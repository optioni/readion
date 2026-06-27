import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { DbModule } from '@readion/db'
import { AgentWorkerModule } from './agent/agent.module'
import { WorkerConfigModule } from './config/config.module'
import { ContentPipelineModule } from './content-pipeline/content-pipeline.module'
import { LifecycleEmailModule } from './lifecycle-email/lifecycle-email.module'
import { WorkerObservabilityModule } from './observability/observability.module'
import { QueueModule } from './queue/queue.module'
import { RedisModule } from './redis/redis.module'
import { ScrapperModule } from './scrapper/scrapper.module'
import { SemanticSearchModule } from './semantic-search/semantic-search.module'
import { SessionsWorkerModule } from './sessions/sessions.module'
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
    ContentPipelineModule,
    SemanticSearchModule,
    SessionsWorkerModule,
    AgentWorkerModule,
    LifecycleEmailModule,
  ],
})
export class AppModule {}
