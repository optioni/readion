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

  it('user lifecycle grace window defaults to 14 days when omitted', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.LIFECYCLE_DELETION_GRACE_DAYS).toBe(14)
  })

  it('accepts a user lifecycle grace-window override', () => {
    const result = parseEnv({ ...VALID_ENV, LIFECYCLE_DELETION_GRACE_DAYS: '30' })
    expect(result.LIFECYCLE_DELETION_GRACE_DAYS).toBe(30)
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

describe('worker env schema — observability group', () => {
  it('resolves LOG_LEVEL to info when omitted', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.LOG_LEVEL).toBe('info')
  })

  it('rejects LOG_LEVEL=verbose (not a pino level) naming the field', () => {
    expect(() => parseEnv({ ...VALID_ENV, LOG_LEVEL: 'verbose' })).toThrow(/LOG_LEVEL/)
  })

  it('rejects a malformed OTEL_EXPORTER_OTLP_ENDPOINT naming the field', () => {
    expect(() => parseEnv({ ...VALID_ENV, OTEL_EXPORTER_OTLP_ENDPOINT: 'not-a-url' })).toThrow(
      /OTEL_EXPORTER_OTLP_ENDPOINT/,
    )
  })

  it('boots when optional SENTRY_DSN and OTEL endpoint are absent', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.SENTRY_DSN).toBeUndefined()
    expect(result.SENTRY_RELEASE).toBeUndefined()
    expect(result.OTEL_EXPORTER_OTLP_ENDPOINT).toBeUndefined()
  })

  it('accepts a SENTRY_RELEASE string', () => {
    const result = parseEnv({ ...VALID_ENV, SENTRY_RELEASE: 'abc123' })
    expect(result.SENTRY_RELEASE).toBe('abc123')
  })

  it('resolves PROMETHEUS_PORT to 9091 when omitted', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.PROMETHEUS_PORT).toBe(9091)
  })

  it('accepts PROMETHEUS_PORT as a string number', () => {
    const result = parseEnv({ ...VALID_ENV, PROMETHEUS_PORT: '9999' })
    expect(result.PROMETHEUS_PORT).toBe(9999)
  })

  it('rejects a non-numeric PROMETHEUS_PORT naming the field', () => {
    expect(() => parseEnv({ ...VALID_ENV, PROMETHEUS_PORT: 'abc' })).toThrow(/PROMETHEUS_PORT/)
  })
})
