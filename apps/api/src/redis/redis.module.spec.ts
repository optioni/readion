import { Test } from '@nestjs/testing'
import { startRedisContainer } from '@readion/db'
import type Redis from 'ioredis'
import type { StartedTestContainer } from 'testcontainers'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ApiConfigModule } from '../config/config.module'
import { REDIS_CLIENT, RedisModule } from './redis.module'

describe('RedisModule', () => {
  let redisContainer: StartedTestContainer
  let redisClient: Redis

  beforeAll(async () => {
    redisContainer = await startRedisContainer()
    const host = redisContainer.getHost()
    const port = redisContainer.getMappedPort(6379)

    process.env.REDIS_URL = `redis://${host}:${port}`
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ?? 'postgresql://readion:readion@localhost:5432/readion_test'

    const moduleRef = await Test.createTestingModule({
      imports: [ApiConfigModule, RedisModule],
    }).compile()

    redisClient = moduleRef.get<Redis>(REDIS_CLIENT)
  }, 60_000)

  afterAll(async () => {
    await redisClient?.quit()
    await redisContainer?.stop()
  })

  it('exposes a REDIS_CLIENT that responds to PING', async () => {
    const pong = await redisClient.ping()
    expect(pong).toBe('PONG')
  })
})
