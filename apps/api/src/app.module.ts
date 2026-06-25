import { Module } from '@nestjs/common'
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { ThrottlerGuard } from '@nestjs/throttler'
import { DbModule } from '@readion/db'
import { AuthModule } from './auth/auth.module'
import { CertificationsModule } from './certifications/certifications.module'
import { ResponseInterceptor } from './common/interceptors/response.interceptor'
import { ApiConfigModule } from './config/config.module'
import { HealthModule } from './health/health.module'
import { LlmModule } from './llm/llm.module'
import { MailModule } from './mail/mail.module'
import { ApiObservabilityModule } from './observability/observability.module'
import { QuizModule } from './quiz/quiz.module'
import { RedisModule } from './redis/redis.module'
import { ApiThrottlerModule } from './throttler/throttler.module'
import { UserCertificationsModule } from './user-certifications/user-certifications.module'
import { UsersModule } from './users/users.module'
import { WeakAreasModule } from './weak-areas/weak-areas.module'

@Module({
  imports: [
    ApiConfigModule,
    ApiObservabilityModule.forRoot(),
    DbModule,
    RedisModule,
    LlmModule,
    ApiThrottlerModule,
    HealthModule,
    MailModule,
    AuthModule,
    UsersModule,
    CertificationsModule,
    UserCertificationsModule,
    QuizModule,
    WeakAreasModule,
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
