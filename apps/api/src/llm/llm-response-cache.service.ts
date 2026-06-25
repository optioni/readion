import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type Redis from 'ioredis'
import type { EnvConfig } from '../config/env.schema'
import { REDIS_CLIENT } from '../redis/redis.module'
import type { LlmGenerateResult } from './types'

export type VerifiedPayload = LlmGenerateResult & { verified: true }

@Injectable()
export class LlmResponseCacheService {
  private readonly ttl: number

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService<EnvConfig>,
  ) {
    this.ttl = this.config.get<number>('AI_RESPONSE_CACHE_TTL_SECONDS') ?? 86_400
  }

  async set(key: string, payload: VerifiedPayload): Promise<void> {
    if (!payload.verified) {
      throw new Error('Cannot cache an unverified payload')
    }
    await this.redis.set(key, JSON.stringify(payload), 'EX', this.ttl)
  }

  async get(key: string): Promise<VerifiedPayload | null> {
    const raw = await this.redis.get(key)
    if (!raw) return null
    return JSON.parse(raw) as VerifiedPayload
  }

  async evict(key: string): Promise<void> {
    await this.redis.del(key)
  }
}
