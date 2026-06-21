import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis'
import { Module } from '@nestjs/common'
import { ThrottlerModule } from '@nestjs/throttler'
import type Redis from 'ioredis'
import { REDIS_CLIENT } from '../redis/redis.module'
import { buildThrottlerOptions, THROTTLER_DEFAULTS } from './throttler.config'

function envNum(key: string, fallback: number): number {
  const val = process.env[key]
  return val !== undefined ? Number(val) : fallback
}

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis) => ({
        ...buildThrottlerOptions({
          THROTTLER_AUTH_LIMIT: envNum('THROTTLER_AUTH_LIMIT', THROTTLER_DEFAULTS.AUTH_LIMIT),
          THROTTLER_AUTH_TTL: envNum('THROTTLER_AUTH_TTL', THROTTLER_DEFAULTS.AUTH_TTL),
          THROTTLER_AGENT_LIMIT: envNum('THROTTLER_AGENT_LIMIT', THROTTLER_DEFAULTS.AGENT_LIMIT),
          THROTTLER_AGENT_TTL: envNum('THROTTLER_AGENT_TTL', THROTTLER_DEFAULTS.AGENT_TTL),
          THROTTLER_GENERAL_LIMIT: envNum(
            'THROTTLER_GENERAL_LIMIT',
            THROTTLER_DEFAULTS.GENERAL_LIMIT,
          ),
          THROTTLER_GENERAL_TTL: envNum('THROTTLER_GENERAL_TTL', THROTTLER_DEFAULTS.GENERAL_TTL),
        }),
        storage: new ThrottlerStorageRedisService(redis),
      }),
    }),
  ],
  exports: [ThrottlerModule],
})
export class ApiThrottlerModule {}
