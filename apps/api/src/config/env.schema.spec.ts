import { describe, expect, it } from 'vitest'
import { parseEnv } from './env.schema'

const VALID_ENV = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  PORT: '3001',
  NODE_ENV: 'development',
  CORS_ORIGIN: 'http://localhost:3000',
}

describe('env schema', () => {
  it('parses a valid env object and coerces PORT to number', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.PORT).toBe(3001)
    expect(result.NODE_ENV).toBe('development')
    expect(result.CORS_ORIGIN).toBe('http://localhost:3000')
  })

  it('resolves CORS default when CORS_ORIGIN is omitted', () => {
    const { CORS_ORIGIN: _, ...rest } = VALID_ENV
    const result = parseEnv(rest)
    expect(result.CORS_ORIGIN).toBe('http://localhost:3000')
  })

  it('resolves PORT default of 3001 when PORT is omitted', () => {
    const { PORT: _, ...rest } = VALID_ENV
    const result = parseEnv(rest)
    expect(result.PORT).toBe(3001)
  })

  it('throws when DATABASE_URL is missing', () => {
    const { DATABASE_URL: _, ...rest } = VALID_ENV
    expect(() => parseEnv(rest)).toThrow(/DATABASE_URL/)
  })

  it('throws when REDIS_URL is missing', () => {
    const { REDIS_URL: _, ...rest } = VALID_ENV
    expect(() => parseEnv(rest)).toThrow(/REDIS_URL/)
  })

  it('throws when PORT is non-numeric', () => {
    expect(() => parseEnv({ ...VALID_ENV, PORT: 'abc' })).toThrow(/PORT/)
  })

  it('exposes throttler tier defaults when overrides are absent', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.THROTTLER_AUTH_LIMIT).toBe(10)
    expect(result.THROTTLER_AUTH_TTL).toBe(900_000)
    expect(result.THROTTLER_AGENT_LIMIT).toBe(30)
    expect(result.THROTTLER_AGENT_TTL).toBe(60_000)
    expect(result.THROTTLER_GENERAL_LIMIT).toBe(300)
    expect(result.THROTTLER_GENERAL_TTL).toBe(60_000)
  })

  it('accepts throttler overrides from env', () => {
    const result = parseEnv({
      ...VALID_ENV,
      THROTTLER_AUTH_LIMIT: '5',
      THROTTLER_AUTH_TTL: '300000',
    })
    expect(result.THROTTLER_AUTH_LIMIT).toBe(5)
    expect(result.THROTTLER_AUTH_TTL).toBe(300_000)
  })
})

describe('env schema — observability group', () => {
  it('resolves LOG_LEVEL to info when omitted', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.LOG_LEVEL).toBe('info')
  })

  it('accepts all valid pino log levels', () => {
    for (const level of ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']) {
      expect(() => parseEnv({ ...VALID_ENV, LOG_LEVEL: level })).not.toThrow()
    }
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

  it('accepts a valid OTEL endpoint URL', () => {
    const result = parseEnv({
      ...VALID_ENV,
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://otel-collector:4318',
    })
    expect(result.OTEL_EXPORTER_OTLP_ENDPOINT).toBe('http://otel-collector:4318')
  })

  it('accepts a SENTRY_DSN string', () => {
    const result = parseEnv({ ...VALID_ENV, SENTRY_DSN: 'https://abc@sentry.io/0' })
    expect(result.SENTRY_DSN).toBe('https://abc@sentry.io/0')
  })

  it('accepts a SENTRY_RELEASE string', () => {
    const result = parseEnv({ ...VALID_ENV, SENTRY_RELEASE: 'abc123' })
    expect(result.SENTRY_RELEASE).toBe('abc123')
  })
})
