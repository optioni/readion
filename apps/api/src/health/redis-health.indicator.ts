import { Inject, Injectable } from '@nestjs/common'
import type { HealthIndicatorResult } from '@nestjs/terminus'
import { HealthIndicatorService } from '@nestjs/terminus'
import type Redis from 'ioredis'
import { REDIS_CLIENT } from '../redis/redis.module'

@Injectable()
export class RedisHealthIndicator {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key)
    try {
      const pong = await this.redis.ping()
      return pong === 'PONG' ? indicator.up() : indicator.down({ message: 'ping failed' })
    } catch {
      return indicator.down({ message: 'unreachable' })
    }
  }
}
