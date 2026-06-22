import { describe, expect, it } from 'vitest'
import { parseEnv } from './env.schema'

const VALID_ENV = {
  DATABASE_URL: 'postgresql://readion:readion@localhost:5432/readion',
  REDIS_URL: 'redis://localhost:6379',
  SCRAPPER_URL: 'http://localhost:3001',
  NODE_ENV: 'development',
}

describe('worker env schema', () => {
  it('Valid config exposes typed values', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.DATABASE_URL).toBe(VALID_ENV.DATABASE_URL)
    expect(result.REDIS_URL).toBe(VALID_ENV.REDIS_URL)
    expect(result.SCRAPPER_URL).toBe(VALID_ENV.SCRAPPER_URL)
    expect(result.NODE_ENV).toBe('development')
  })

  it('NODE_ENV defaults to development when omitted', () => {
    const { NODE_ENV: _, ...rest } = VALID_ENV
    const result = parseEnv(rest)
    expect(result.NODE_ENV).toBe('development')
  })

  it('Boot fails when a required variable is missing (REDIS_URL)', () => {
    const { REDIS_URL: _, ...rest } = VALID_ENV
    expect(() => parseEnv(rest)).toThrow(/REDIS_URL/)
  })

  it('Boot fails when DATABASE_URL is missing', () => {
    const { DATABASE_URL: _, ...rest } = VALID_ENV
    expect(() => parseEnv(rest)).toThrow(/DATABASE_URL/)
  })

  it('Boot fails when a URL variable is malformed (SCRAPPER_URL)', () => {
    expect(() => parseEnv({ ...VALID_ENV, SCRAPPER_URL: 'not-a-url' })).toThrow(/SCRAPPER_URL/)
  })

  it('Boot fails when SCRAPPER_URL is missing', () => {
    const { SCRAPPER_URL: _, ...rest } = VALID_ENV
    expect(() => parseEnv(rest)).toThrow(/SCRAPPER_URL/)
  })
})
