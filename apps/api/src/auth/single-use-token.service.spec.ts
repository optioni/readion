import { PasswordResetTokenService, VerificationTokenService } from './single-use-token.service'

describe('single-use auth token services', () => {
  it('issues, validates, and consumes verification tokens once', async () => {
    const redis = new ExpiringFakeRedis()
    const service = new VerificationTokenService(redis)

    const token = await service.issue('user-1')

    await expect(service.validate(token)).resolves.toEqual({ userId: 'user-1' })
    await expect(service.consume(token)).resolves.toEqual({ userId: 'user-1' })
    await expect(service.validate(token)).resolves.toBeNull()
    await expect(service.consume(token)).resolves.toBeNull()
  })

  it('expires password reset tokens after one hour', async () => {
    const redis = new ExpiringFakeRedis()
    const service = new PasswordResetTokenService(redis)

    const token = await service.issue('user-1')

    await expect(service.validate(token)).resolves.toEqual({ userId: 'user-1' })
    redis.advanceBy(3_600_001)
    await expect(service.validate(token)).resolves.toBeNull()
  })
})

class ExpiringFakeRedis {
  private now = 0
  private values = new Map<string, { value: string; expiresAt: number }>()

  async get(key: string) {
    const item = this.values.get(key)

    if (item === undefined || item.expiresAt <= this.now) {
      this.values.delete(key)
      return null
    }

    return item.value
  }

  async set(key: string, value: string, mode: 'EX', ttlSeconds: number) {
    this.values.set(key, { value, expiresAt: this.now + ttlSeconds * 1000 })
    return 'OK'
  }

  async del(key: string) {
    return this.values.delete(key) ? 1 : 0
  }

  advanceBy(milliseconds: number) {
    this.now += milliseconds
  }
}
