import { RefreshTokenStore } from './refresh-token.store'

describe('RefreshTokenStore', () => {
  it('issues, validates, rotates, rejects replay, rejects unknown, and revokes all user tokens', async () => {
    const redis = new FakeRedis()
    const store = new RefreshTokenStore(redis)

    const first = await store.issue('user-1')
    await expect(store.validate(first.token)).resolves.toEqual({ userId: 'user-1' })

    const rotated = await store.rotate(first.token)
    expect(rotated).not.toBeNull()
    await expect(store.validate(first.token)).resolves.toBeNull()
    await expect(store.rotate(first.token)).resolves.toBeNull()
    await expect(store.validate('unknown.token.value')).resolves.toBeNull()

    if (rotated === null) {
      throw new Error('expected rotated token')
    }

    await expect(store.validate(rotated.token)).resolves.toEqual({ userId: 'user-1' })
    await store.revokeAllForUser('user-1')
    await expect(store.validate(rotated.token)).resolves.toBeNull()
  })

  it('revoke invalidates only the specified token, leaving other tokens intact', async () => {
    const redis = new FakeRedis()
    const store = new RefreshTokenStore(redis)

    const sessionA = await store.issue('user-1')
    const sessionB = await store.issue('user-1')

    await store.revoke(sessionA.token)

    await expect(store.validate(sessionA.token)).resolves.toBeNull()
    await expect(store.validate(sessionB.token)).resolves.toEqual({ userId: 'user-1' })
  })
})

class FakeRedis {
  private values = new Map<string, string>()
  private sets = new Map<string, Set<string>>()

  async get(key: string) {
    return this.values.get(key) ?? null
  }

  async set(key: string, value: string) {
    this.values.set(key, value)
    return 'OK'
  }

  async del(...keys: string[]) {
    let deleted = 0

    for (const key of keys) {
      if (this.values.delete(key)) {
        deleted += 1
      }
      if (this.sets.delete(key)) {
        deleted += 1
      }
    }

    return deleted
  }

  async sadd(key: string, value: string) {
    const set = this.sets.get(key) ?? new Set<string>()
    set.add(value)
    this.sets.set(key, set)
    return 1
  }

  async srem(key: string, value: string) {
    const set = this.sets.get(key)
    if (set) {
      set.delete(value)
    }
    return 1
  }

  async smembers(key: string) {
    return [...(this.sets.get(key) ?? new Set<string>())]
  }

  async expire() {
    return 1
  }
}
