import { randomBytes } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import {
  PASSWORD_RESET_TOKEN_TTL_SECONDS,
  singleUseTokenKey,
  singleUseTokenUserKey,
  VERIFICATION_TOKEN_TTL_SECONDS,
} from './token-redis.helpers'

type RedisLike = {
  get(key: string): Promise<string | null>
  set(key: string, value: string, mode: 'EX', ttlSeconds: number): Promise<unknown>
  del(key: string): Promise<unknown>
}

class SingleUseTokenService {
  constructor(
    private readonly redis: RedisLike,
    private readonly namespace: string,
    private readonly ttlSeconds: number,
  ) {}

  async issue(userId: string) {
    const token = randomBytes(32).toString('base64url')
    const activeKey = this.userKey(userId)
    const previousToken = await this.redis.get(activeKey)

    if (previousToken !== null) {
      await this.redis.del(this.key(previousToken))
    }

    await this.redis.set(this.key(token), userId, 'EX', this.ttlSeconds)
    await this.redis.set(activeKey, token, 'EX', this.ttlSeconds)
    return token
  }

  async validate(token: string) {
    const userId = await this.redis.get(this.key(token))

    if (userId === null) {
      return null
    }

    const activeToken = await this.redis.get(this.userKey(userId))
    return activeToken === token ? { userId } : null
  }

  async consume(token: string) {
    const result = await this.validate(token)

    if (result === null) {
      return null
    }

    await this.redis.del(this.key(token))
    await this.redis.del(this.userKey(result.userId))
    return result
  }

  private key(token: string) {
    return singleUseTokenKey(this.namespace, token)
  }

  private userKey(userId: string) {
    return singleUseTokenUserKey(this.namespace, userId)
  }
}

@Injectable()
export class VerificationTokenService extends SingleUseTokenService {
  constructor(redis: RedisLike) {
    super(redis, 'verification', VERIFICATION_TOKEN_TTL_SECONDS)
  }
}

@Injectable()
export class PasswordResetTokenService extends SingleUseTokenService {
  constructor(redis: RedisLike) {
    super(redis, 'password-reset', PASSWORD_RESET_TOKEN_TTL_SECONDS)
  }
}
