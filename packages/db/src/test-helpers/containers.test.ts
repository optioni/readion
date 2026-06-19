import { Client as PgClient } from 'pg'
import { createClient } from 'redis'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startPostgresContainer, startRedisContainer } from './containers'

describe('Testcontainers integration', () => {
  let pgContainer: Awaited<ReturnType<typeof startPostgresContainer>>
  let redisContainer: Awaited<ReturnType<typeof startRedisContainer>>

  beforeAll(async () => {
    ;[pgContainer, redisContainer] = await Promise.all([
      startPostgresContainer(),
      startRedisContainer(),
    ])
  }, 120_000)

  afterAll(async () => {
    await Promise.all([pgContainer?.stop(), redisContainer?.stop()])
  })

  it('Postgres pgvector extension installs successfully', async () => {
    const client = new PgClient({
      host: pgContainer.getHost(),
      port: pgContainer.getMappedPort(5432),
      user: 'readion',
      password: 'readion',
      database: 'readion_test',
    })
    await client.connect()
    const result = await client.query('CREATE EXTENSION IF NOT EXISTS vector;')
    expect(result.command).toBe('CREATE')
    await client.end()
  })

  it('Redis responds PONG to PING', async () => {
    const client = createClient({
      socket: {
        host: redisContainer.getHost(),
        port: redisContainer.getMappedPort(6379),
      },
    })
    await client.connect()
    const pong = await client.ping()
    expect(pong).toBe('PONG')
    await client.disconnect()
  })
})
