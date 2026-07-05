import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  dbConnectionEnvFragment,
  redisUrlFragment,
  zodCoerceBoolean,
  zodCoerceNumber,
  zodRequiredUrl,
} from './helpers'

describe('zodRequiredUrl', () => {
  it('accepts a valid postgres URL', () => {
    const result = zodRequiredUrl().safeParse('postgres://localhost:5432/readion')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe('postgres://localhost:5432/readion')
  })

  it('accepts a valid redis URL', () => {
    const result = zodRequiredUrl().safeParse('redis://localhost:6379')
    expect(result.success).toBe(true)
  })

  it('rejects a malformed value', () => {
    const result = zodRequiredUrl().safeParse('not-a-url')
    expect(result.success).toBe(false)
  })

  it('rejects an empty string', () => {
    const result = zodRequiredUrl().safeParse('')
    expect(result.success).toBe(false)
  })
})

describe('zodCoerceNumber', () => {
  it('coerces string "9090" to number 9090', () => {
    const result = zodCoerceNumber().safeParse('9090')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe(9090)
  })

  it('coerces numeric string "3000" to number 3000', () => {
    const result = zodCoerceNumber().safeParse('3000')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe(3000)
  })

  it('passes a plain number through', () => {
    const result = zodCoerceNumber().safeParse(8080)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe(8080)
  })

  it('rejects non-numeric string "abc"', () => {
    const result = zodCoerceNumber().safeParse('abc')
    expect(result.success).toBe(false)
  })

  it('rejects empty string', () => {
    const result = zodCoerceNumber().safeParse('')
    expect(result.success).toBe(false)
  })
})

describe('zodCoerceBoolean', () => {
  it('coerces string "true" to true', () => {
    const result = zodCoerceBoolean().safeParse('true')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe(true)
  })

  it('coerces string "false" to false', () => {
    const result = zodCoerceBoolean().safeParse('false')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe(false)
  })

  it('passes boolean true through', () => {
    const result = zodCoerceBoolean().safeParse(true)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe(true)
  })

  it('coerces "1" to true', () => {
    const result = zodCoerceBoolean().safeParse('1')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe(true)
  })

  it('coerces "0" to false', () => {
    const result = zodCoerceBoolean().safeParse('0')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe(false)
  })
})

describe('shared env fragments', () => {
  it('dbConnectionEnvFragment composes and parses DB_* vars', () => {
    const schema = z.object({ ...dbConnectionEnvFragment })
    const result = schema.safeParse({
      DB_HOST: 'db.internal',
      DB_PORT: '5432',
      DB_USER: 'readion',
      DB_PASSWORD: 'secret',
      DB_NAME: 'readion',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.DB_HOST).toBe('db.internal')
      expect(result.data.DB_PORT).toBe(5432)
    }
  })

  it('dbConnectionEnvFragment is optional — an empty object still parses', () => {
    const schema = z.object({ ...dbConnectionEnvFragment })
    const result = schema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.DB_HOST).toBeUndefined()
  })

  it('redisUrlFragment composes and parses REDIS_URL', () => {
    const schema = z.object({ ...redisUrlFragment })
    const result = schema.safeParse({ REDIS_URL: 'redis://localhost:6379' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.REDIS_URL).toBe('redis://localhost:6379')
  })

  it('composing DB+Redis fragments parses a valid combined object', () => {
    const schema = z.object({ ...dbConnectionEnvFragment, ...redisUrlFragment })
    const result = schema.safeParse({
      DB_HOST: 'db.internal',
      REDIS_URL: 'redis://localhost:6379',
    })
    expect(result.success).toBe(true)
  })

  it('missing REDIS_URL names the var in the error', () => {
    const schema = z.object({ ...redisUrlFragment })
    const result = schema.safeParse({})
    expect(result.success).toBe(false)
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0])
      expect(fields).toContain('REDIS_URL')
    }
  })
})
