import { Module } from '@nestjs/common'
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { ThrottlerGuard } from '@nestjs/throttler'
import { DbModule } from '@readion/db'
import { ResponseInterceptor } from './common/interceptors/response.interceptor'
import { ApiConfigModule } from './config/config.module'
import { HealthModule } from './health/health.module'
import { MailModule } from './mail/mail.module'
import { ApiObservabilityModule } from './observability/observability.module'
import { RedisModule } from './redis/redis.module'
import { ApiThrottlerModule } from './throttler/throttler.module'

@Module({
  imports: [
    ApiConfigModule,
    ApiObservabilityModule.forRoot(),
    DbModule,
    RedisModule,
    ApiThrottlerModule,
    HealthModule,
    MailModule,
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
