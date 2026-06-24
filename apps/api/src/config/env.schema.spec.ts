import { describe, expect, it } from 'vitest'
import { parseEnv } from './env.schema'

const VALID_ENV = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  PORT: '3001',
  NODE_ENV: 'development',
  CORS_ORIGIN: 'http://localhost:3000',
  SMTP_HOST: 'mail.smtp2go.com',
  SMTP_PORT: '2525',
  SMTP_USERNAME: 'smtp-user',
  SMTP_PASSWORD: 'smtp-password',
  MAIL_FROM: 'Readion <no-reply@readion.app>',
  JWT_SECRET: 'test-secret-with-at-least-32-characters',
  JWT_ACCESS_TOKEN_EXPIRES_IN_SECONDS: '900',
  JWT_REFRESH_TOKEN_EXPIRES_IN_SECONDS: '604800',
  WEB_BASE_URL: 'http://localhost:3000',
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

  it('exposes user lifecycle defaults when overrides are absent', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.LIFECYCLE_DELETION_GRACE_DAYS).toBe(14)
    expect(result.DEFAULT_DISPLAY_TIMEZONE).toBe('Europe/Helsinki')
  })

  it('accepts user lifecycle overrides from env', () => {
    const result = parseEnv({
      ...VALID_ENV,
      LIFECYCLE_DELETION_GRACE_DAYS: '30',
      DEFAULT_DISPLAY_TIMEZONE: 'America/New_York',
    })
    expect(result.LIFECYCLE_DELETION_GRACE_DAYS).toBe(30)
    expect(result.DEFAULT_DISPLAY_TIMEZONE).toBe('America/New_York')
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

describe('env schema — email group', () => {
  it('parses valid email config and coerces SMTP_PORT to number', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.SMTP_HOST).toBe('mail.smtp2go.com')
    expect(result.SMTP_PORT).toBe(2525)
    expect(result.SMTP_USERNAME).toBe('smtp-user')
    expect(result.SMTP_PASSWORD).toBe('smtp-password')
    expect(result.MAIL_FROM).toBe('Readion <no-reply@readion.app>')
  })

  it('throws when SMTP_PASSWORD is missing', () => {
    const { SMTP_PASSWORD: _, ...rest } = { ...VALID_ENV, NODE_ENV: 'production' }
    expect(() => parseEnv(rest)).toThrow(/SMTP_PASSWORD/)
  })

  it('allows credential-free development to use the capturing transport', () => {
    const result = parseEnv({
      DATABASE_URL: VALID_ENV.DATABASE_URL,
      REDIS_URL: VALID_ENV.REDIS_URL,
      NODE_ENV: 'development',
      MAIL_FROM: VALID_ENV.MAIL_FROM,
      JWT_SECRET: VALID_ENV.JWT_SECRET,
      WEB_BASE_URL: VALID_ENV.WEB_BASE_URL,
    })

    expect(result.NODE_ENV).toBe('development')
    expect(result.SMTP_USERNAME).toBeUndefined()
    expect(result.SMTP_PASSWORD).toBeUndefined()
  })

  it('throws when SMTP_PORT is non-numeric', () => {
    expect(() => parseEnv({ ...VALID_ENV, SMTP_PORT: 'not-a-number' })).toThrow(/SMTP_PORT/)
  })

  it('throws when MAIL_FROM is not an email address', () => {
    expect(() => parseEnv({ ...VALID_ENV, MAIL_FROM: 'not-an-email' })).toThrow(/MAIL_FROM/)
  })
})

describe('env schema — auth group', () => {
  it('throws when JWT_SECRET is missing', () => {
    const { JWT_SECRET: _, ...rest } = VALID_ENV
    expect(() => parseEnv(rest)).toThrow(/JWT_SECRET/)
  })

  it('throws when WEB_BASE_URL is malformed', () => {
    expect(() => parseEnv({ ...VALID_ENV, WEB_BASE_URL: 'not-a-url' })).toThrow(/WEB_BASE_URL/)
  })

  it('exposes typed access and refresh token expiries', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.JWT_ACCESS_TOKEN_EXPIRES_IN_SECONDS).toBe(900)
    expect(result.JWT_REFRESH_TOKEN_EXPIRES_IN_SECONDS).toBe(604_800)
    expect(result.WEB_BASE_URL).toBe('http://localhost:3000')
  })

  it('exposes bcrypt cost with a low-test override', () => {
    const result = parseEnv({ ...VALID_ENV, BCRYPT_COST: '4' })
    expect(result.BCRYPT_COST).toBe(4)
  })
})
