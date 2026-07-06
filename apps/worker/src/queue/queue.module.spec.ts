import { describe, expect, it } from 'vitest'
import { buildQueueConnection } from './queue.module'

describe('buildQueueConnection', () => {
  it('carries auth credentials and db across from the ioredis options', () => {
    const connection = buildQueueConnection({
      host: 'redis.redis',
      port: 6379,
      username: 'default',
      password: 's3cr3t',
      db: 1,
    })

    expect(connection).toMatchObject({
      host: 'redis.redis',
      port: 6379,
      username: 'default',
      password: 's3cr3t',
      db: 1,
    })
  })

  it('falls back to localhost:6379 when host and port are absent', () => {
    const connection = buildQueueConnection({})

    expect(connection.host).toBe('localhost')
    expect(connection.port).toBe(6379)
  })
})
