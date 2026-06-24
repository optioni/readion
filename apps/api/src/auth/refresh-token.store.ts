import { randomBytes, randomUUID } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import {
  REFRESH_TOKEN_TTL_SECONDS,
  refreshTokenIndexKey,
  refreshTokenKey,
} from './token-redis.helpers'

type RedisLike = {
  get(key: string): Promise<string | null>
  set(key: string, value: string, mode: 'EX', ttlSeconds: number): Promise<unknown>
  del(...keys: string[]): Promise<unknown>
  sadd(key: string, value: string): Promise<unknown>
  srem(key: string, value: string): Promise<unknown>
  smembers(key: string): Promise<string[]>
  expire(key: string, ttlSeconds: number): Promise<unknown>
}

export type RefreshTokenIssue = {
  token: string
  userId: string
}

@Injectable()
export class RefreshTokenStore {
  constructor(private readonly redis: RedisLike) {}

  async issue(userId: string): Promise<RefreshTokenIssue> {
    const tokenId = randomUUID()
    const secret = randomBytes(32).toString('base64url')
    const token = `${userId}.${tokenId}.${secret}`
    const tokenKey = refreshTokenKey(userId, tokenId)
    const indexKey = refreshTokenIndexKey(userId)

    await this.redis.set(tokenKey, secret, 'EX', REFRESH_TOKEN_TTL_SECONDS)
    await this.redis.sadd(indexKey, tokenKey)
    await this.redis.expire(indexKey, REFRESH_TOKEN_TTL_SECONDS)

    return { token, userId }
  }

  async validate(token: string) {
    const parsed = this.parse(token)

    if (parsed === null) {
      return null
    }

    const secret = await this.redis.get(refreshTokenKey(parsed.userId, parsed.tokenId))

    if (secret !== parsed.secret) {
      return null
    }

    return { userId: parsed.userId }
  }

  async revoke(token: string) {
    const parsed = this.parse(token)

    if (parsed === null) {
      return
    }

    const tokenKey = refreshTokenKey(parsed.userId, parsed.tokenId)
    const indexKey = refreshTokenIndexKey(parsed.userId)
    await this.redis.del(tokenKey)
    await this.redis.srem(indexKey, tokenKey)
  }

  async rotate(token: string) {
    const parsed = this.parse(token)

    if (parsed === null) {
      return null
    }

    const tokenKey = refreshTokenKey(parsed.userId, parsed.tokenId)
    const indexKey = refreshTokenIndexKey(parsed.userId)
    const secret = await this.redis.get(tokenKey)

    if (secret !== parsed.secret) {
      return null
    }

    await this.redis.del(tokenKey)
    await this.redis.srem(indexKey, tokenKey)
    return this.issue(parsed.userId)
  }

  async revokeAllForUser(userId: string) {
    const indexKey = refreshTokenIndexKey(userId)
    const tokenKeys = await this.redis.smembers(indexKey)

    if (tokenKeys.length > 0) {
      await this.redis.del(...tokenKeys)
    }

    await this.redis.del(indexKey)
  }

  private parse(token: string) {
    const [userId, tokenId, secret] = token.split('.')

    if (!userId || !tokenId || !secret) {
      return null
    }

    return { userId, tokenId, secret }
  }
}
