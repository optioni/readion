import { BullModule } from '@nestjs/bullmq'
import { Global, Module } from '@nestjs/common'
import type Redis from 'ioredis'
import { REDIS_CLIENT } from '../redis/redis.module'

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis) => ({
        connection: {
          host: redis.options.host ?? 'localhost',
          port: redis.options.port ?? 6379,
        },
      }),
    }),
  ],
})
export class QueueModule {}
