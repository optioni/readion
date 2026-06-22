import { Test } from '@nestjs/testing'
import { startRedisContainer } from '@readion/db'
import type Redis from 'ioredis'
import type { StartedTestContainer } from 'testcontainers'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { REDIS_CLIENT, RedisModule } from './redis.module'

describe('RedisModule', () => {
  let redisContainer: StartedTestContainer

  beforeAll(async () => {
    redisContainer = await startRedisContainer()
  }, 60_000)

  afterAll(async () => {
    await redisContainer?.stop()
  })

  it('Redis client is injectable and responds to PING', async () => {
    const host = redisContainer.getHost()
    const port = redisContainer.getMappedPort(6379)
    process.env.REDIS_URL = `redis://${host}:${port}`

    const moduleRef = await Test.createTestingModule({
      imports: [RedisModule],
    }).compile()

    const client = moduleRef.get<Redis>(REDIS_CLIENT)
    expect(await client.ping()).toBe('PONG')

    await moduleRef.close()
  })

  it('Connection is closed on shutdown', async () => {
    const host = redisContainer.getHost()
    const port = redisContainer.getMappedPort(6379)
    process.env.REDIS_URL = `redis://${host}:${port}`

    const moduleRef = await Test.createTestingModule({
      imports: [RedisModule],
    }).compile()

    const client = moduleRef.get<Redis>(REDIS_CLIENT)
    // Wait for connection to be established before testing shutdown
    await client.ping()
    expect(client.status).toBe('ready')

    const endedPromise = new Promise<void>((resolve) => {
      if (client.status === 'end') resolve()
      else client.once('end', resolve)
    })
    await moduleRef.close()
    await endedPromise
    expect(client.status).toBe('end')
  })
})
