import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { chunkReverseIndexKey } from '@readion/shared'
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

  async set(key: string, chunkIds: string[], payload: VerifiedPayload): Promise<void> {
    if (!payload.verified) {
      throw new Error('Cannot cache an unverified payload')
    }
    const pipeline = this.redis.pipeline()
    pipeline.set(key, JSON.stringify(payload), 'EX', this.ttl)
    for (const chunkId of chunkIds) {
      pipeline.sadd(chunkReverseIndexKey(chunkId), key)
      pipeline.expire(chunkReverseIndexKey(chunkId), this.ttl)
    }
    await pipeline.exec()
  }

  async get(key: string): Promise<VerifiedPayload | null> {
    const raw = await this.redis.get(key)
    if (!raw) return null
    return JSON.parse(raw) as VerifiedPayload
  }

  async evict(key: string): Promise<void> {
    await this.del(key)
  }

  private async del(...keys: string[]): Promise<void> {
    if (keys.length > 0) {
      await this.redis.del(keys[0]!, ...keys.slice(1))
    }
  }
}
