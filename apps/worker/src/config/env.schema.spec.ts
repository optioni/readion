import { describe, expect, it } from 'vitest'
import { parseEnv } from './env.schema'

const VALID_ENV = {
  DATABASE_URL: 'postgresql://readion:readion@localhost:5432/readion',
  REDIS_URL: 'redis://localhost:6379',
  SCRAPPER_URL: 'http://localhost:3001',
  NODE_ENV: 'development',
  INTERNAL_API_BASE_URL: 'http://localhost:3001',
  INTERNAL_API_SECRET: 'internal-lifecycle-secret',
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

describe('worker env schema — content pipeline', () => {
  it('similarity threshold defaults to 0.75', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.CONTENT_SIMILARITY_THRESHOLD).toBe(0.75)
  })

  it('domain confidence threshold defaults to 0.5', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.CONTENT_DOMAIN_CONFIDENCE_THRESHOLD).toBe(0.5)
  })

  it('accepts domain confidence threshold override', () => {
    const result = parseEnv({ ...VALID_ENV, CONTENT_DOMAIN_CONFIDENCE_THRESHOLD: '0.7' })
    expect(result.CONTENT_DOMAIN_CONFIDENCE_THRESHOLD).toBe(0.7)
  })

  it('chunk size defaults to 500 tokens', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.CONTENT_CHUNK_SIZE).toBe(500)
  })

  it('chunk overlap defaults to 50 tokens', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.CONTENT_CHUNK_OVERLAP).toBe(50)
  })

  it('accepts similarity threshold override', () => {
    const result = parseEnv({ ...VALID_ENV, CONTENT_SIMILARITY_THRESHOLD: '0.8' })
    expect(result.CONTENT_SIMILARITY_THRESHOLD).toBe(0.8)
  })

  it('web recheck interval defaults to 10080 minutes (weekly)', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.CONTENT_RECHECK_WEB_MINUTES).toBe(10_080)
  })

  it('pdf recheck interval defaults to 43200 minutes (monthly)', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.CONTENT_RECHECK_PDF_MINUTES).toBe(43_200)
  })

  it('accepts per-source-type interval override', () => {
    const result = parseEnv({ ...VALID_ENV, CONTENT_RECHECK_WEB_MINUTES: '5040' })
    expect(result.CONTENT_RECHECK_WEB_MINUTES).toBe(5040)
  })

  it('embedding dimension defaults to 1536', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.AI_EMBEDDING_DIMENSION).toBe(1536)
  })

  it('AI provider defaults to openai', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.AI_PROVIDER).toBe('openai')
  })
})

describe('worker env schema — cert coverage thresholds', () => {
  it('CERT_COVERAGE_MIN_CHUNKS_PER_DOMAIN defaults to 20', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.CERT_COVERAGE_MIN_CHUNKS_PER_DOMAIN).toBe(20)
  })

  it('CERT_COVERAGE_TOTAL_CHUNK_MULTIPLE defaults to 3', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.CERT_COVERAGE_TOTAL_CHUNK_MULTIPLE).toBe(3)
  })

  it('accepts CERT_COVERAGE_MIN_CHUNKS_PER_DOMAIN override', () => {
    const result = parseEnv({ ...VALID_ENV, CERT_COVERAGE_MIN_CHUNKS_PER_DOMAIN: '10' })
    expect(result.CERT_COVERAGE_MIN_CHUNKS_PER_DOMAIN).toBe(10)
  })

  it('accepts CERT_COVERAGE_TOTAL_CHUNK_MULTIPLE override', () => {
    const result = parseEnv({ ...VALID_ENV, CERT_COVERAGE_TOTAL_CHUNK_MULTIPLE: '5' })
    expect(result.CERT_COVERAGE_TOTAL_CHUNK_MULTIPLE).toBe(5)
  })

  it('rejects non-positive CERT_COVERAGE_MIN_CHUNKS_PER_DOMAIN', () => {
    expect(() => parseEnv({ ...VALID_ENV, CERT_COVERAGE_MIN_CHUNKS_PER_DOMAIN: '0' })).toThrow(
      /CERT_COVERAGE_MIN_CHUNKS_PER_DOMAIN/,
    )
  })

  it('rejects non-positive CERT_COVERAGE_TOTAL_CHUNK_MULTIPLE', () => {
    expect(() => parseEnv({ ...VALID_ENV, CERT_COVERAGE_TOTAL_CHUNK_MULTIPLE: '0' })).toThrow(
      /CERT_COVERAGE_TOTAL_CHUNK_MULTIPLE/,
    )
  })
})

describe('worker env schema — chunk lifecycle', () => {
  it('superseded chunk retention window defaults to 30 days when unset', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.SUPERSEDED_CHUNK_RETENTION_DAYS).toBe(30)
  })

  it('accepts a retention window override', () => {
    const result = parseEnv({ ...VALID_ENV, SUPERSEDED_CHUNK_RETENTION_DAYS: '60' })
    expect(result.SUPERSEDED_CHUNK_RETENTION_DAYS).toBe(60)
  })

  it('rejects a non-numeric retention window naming the field', () => {
    expect(() =>
      parseEnv({ ...VALID_ENV, SUPERSEDED_CHUNK_RETENTION_DAYS: 'not-a-number' }),
    ).toThrow(/SUPERSEDED_CHUNK_RETENTION_DAYS/)
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

describe('worker env schema — lifecycle email', () => {
  it('exposes the internal API base URL and shared secret', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.INTERNAL_API_BASE_URL).toBe('http://localhost:3001')
    expect(result.INTERNAL_API_SECRET).toBe('internal-lifecycle-secret')
  })

  it('exposes scheduling defaults when overrides are absent', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.DIGEST_SEND_WEEKDAY).toBeTypeOf('number')
    expect(result.DIGEST_SEND_HOUR).toBeTypeOf('number')
    expect(result.NUDGE_ACTIVITY_LULL_DAYS).toBeTypeOf('number')
  })

  it('fails fast naming DIGEST_SEND_HOUR when it is not a number', () => {
    expect(() => parseEnv({ ...VALID_ENV, DIGEST_SEND_HOUR: 'not-a-number' })).toThrow(
      /DIGEST_SEND_HOUR/,
    )
  })

  it('throws when INTERNAL_API_BASE_URL is missing', () => {
    const { INTERNAL_API_BASE_URL: _, ...rest } = VALID_ENV
    expect(() => parseEnv(rest)).toThrow(/INTERNAL_API_BASE_URL/)
  })

  it('throws when INTERNAL_API_SECRET is empty', () => {
    expect(() => parseEnv({ ...VALID_ENV, INTERNAL_API_SECRET: '' })).toThrow(
      /INTERNAL_API_SECRET/,
    )
  })
})
