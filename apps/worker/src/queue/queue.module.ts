import { BullModule } from '@nestjs/bullmq'
import { Global, Module } from '@nestjs/common'
import type Redis from 'ioredis'
import type { RedisOptions } from 'ioredis'
import { REDIS_CLIENT } from '../redis/redis.module'

// BullMQ opens its own Redis connection rather than reusing REDIS_CLIENT, so
// every credential from the parsed REDIS_URL must be carried across or the
// queue connects unauthenticated (NOAUTH) against a password-protected server.
export function buildQueueConnection(options: RedisOptions) {
  return {
    host: options.host ?? 'localhost',
    port: options.port ?? 6379,
    username: options.username,
    password: options.password,
    db: options.db,
    tls: options.tls,
  }
}

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis) => ({
        connection: buildQueueConnection(redis.options),
      }),
    }),
  ],
})
export class QueueModule {}
