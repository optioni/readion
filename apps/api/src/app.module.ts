import { Module } from '@nestjs/common'
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { ScheduleModule } from '@nestjs/schedule'
import { ThrottlerGuard } from '@nestjs/throttler'
import { DbModule } from '@readion/db'
import { AdminModule } from './admin/admin.module'
import { AgentModule } from './agent/agent.module'
import { AuthModule } from './auth/auth.module'
import { CertSetupModule } from './cert-setup/cert-setup.module'
import { CertificationsModule } from './certifications/certifications.module'
import { ResponseInterceptor } from './common/interceptors/response.interceptor'
import { ApiConfigModule } from './config/config.module'
import { ContentModule } from './content/content.module'
import { DiagnosticModule } from './diagnostic/diagnostic.module'
import { HealthModule } from './health/health.module'
import { LlmModule } from './llm/llm.module'
import { MailModule } from './mail/mail.module'
import { MockExamModule } from './mock-exam/mock-exam.module'
import { ApiObservabilityModule } from './observability/observability.module'
import { QueueModule } from './queue/queue.module'
import { QuizModule } from './quiz/quiz.module'
import { ReadinessModule } from './readiness/readiness.module'
import { RedisModule } from './redis/redis.module'
import { ReviewModule } from './review/review.module'
import { SessionSummaryModule } from './session-summary/session-summary.module'
import { SessionsModule } from './sessions/sessions.module'
import { ApiThrottlerModule } from './throttler/throttler.module'
import { UserCertificationsModule } from './user-certifications/user-certifications.module'
import { UsersModule } from './users/users.module'
import { WeakAreasModule } from './weak-areas/weak-areas.module'

@Module({
  imports: [
    ApiConfigModule,
    ApiObservabilityModule.forRoot(),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    DbModule,
    RedisModule,
    QueueModule,
    LlmModule,
    ApiThrottlerModule,
    HealthModule,
    MailModule,
    AuthModule,
    UsersModule,
    CertificationsModule,
    CertSetupModule,
    UserCertificationsModule,
    ContentModule,
    QuizModule,
    WeakAreasModule,
    SessionsModule,
    SessionSummaryModule,
    ReviewModule,
    MockExamModule,
    DiagnosticModule,
    ReadinessModule,
    AgentModule,
    AdminModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
  ],
})
export class AppModule {}
