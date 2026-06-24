import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import type Redis from 'ioredis'
import { MailModule } from '../mail/mail.module'
import { REDIS_CLIENT } from '../redis/redis.module'
import { AccessTokenService } from './access-token.service'
import { AuthController } from './auth.controller'
import { JwtAuthGuard, RolesGuard } from './auth.guards'
import { AuthService } from './auth.service'
import { CsrfGuard } from './csrf.guard'
import { PasswordHashingService } from './password-hashing.service'
import { RefreshTokenStore } from './refresh-token.store'
import { PasswordResetTokenService, VerificationTokenService } from './single-use-token.service'

@Module({
  imports: [JwtModule.register({}), MailModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    AccessTokenService,
    PasswordHashingService,
    {
      provide: RefreshTokenStore,
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis) => new RefreshTokenStore(redis),
    },
    {
      provide: VerificationTokenService,
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis) => new VerificationTokenService(redis),
    },
    {
      provide: PasswordResetTokenService,
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis) => new PasswordResetTokenService(redis),
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
  ],
  exports: [AccessTokenService, PasswordHashingService],
})
export class AuthModule {}
