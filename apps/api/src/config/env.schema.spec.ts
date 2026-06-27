import { describe, expect, it } from 'vitest'
import { parseEnv } from './env.schema'

const VALID_AI_ENV = {
  AI_PROVIDER: 'anthropic',
  AI_MODEL_QUIZ_GENERATION: 'claude-haiku-4-5',
  AI_MODEL_ANSWER_VERIFICATION: 'claude-haiku-4-5',
  AI_MODEL_DOMAIN_TAGGING: 'claude-haiku-4-5',
  AI_MODEL_AGENT_QA: 'claude-sonnet-4-6',
  AI_MODEL_CERTIFICATION_PREFILL: 'claude-sonnet-4-6',
  AI_MODEL_MATERIAL_GENERATION: 'claude-sonnet-4-6',
  AI_MODEL_COMPLEX_REASONING: 'claude-sonnet-4-6',
}

const VALID_ENV = {
  ...VALID_AI_ENV,
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
  PUBLIC_API_URL: 'http://localhost:3001',
  INTERNAL_API_SECRET: 'internal-lifecycle-secret',
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
      ...VALID_AI_ENV,
      DATABASE_URL: VALID_ENV.DATABASE_URL,
      REDIS_URL: VALID_ENV.REDIS_URL,
      NODE_ENV: 'development',
      MAIL_FROM: VALID_ENV.MAIL_FROM,
      JWT_SECRET: VALID_ENV.JWT_SECRET,
      WEB_BASE_URL: VALID_ENV.WEB_BASE_URL,
      PUBLIC_API_URL: VALID_ENV.PUBLIC_API_URL,
      INTERNAL_API_SECRET: VALID_ENV.INTERNAL_API_SECRET,
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

describe('env schema — AI provider group', () => {
  it('parses a valid AI configuration with all required fields', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.AI_PROVIDER).toBe('anthropic')
    expect(result.AI_MODEL_QUIZ_GENERATION).toBe('claude-haiku-4-5')
    expect(result.AI_MODEL_AGENT_QA).toBe('claude-sonnet-4-6')
  })

  it('throws when AI_PROVIDER is missing', () => {
    const { AI_PROVIDER: _, ...rest } = VALID_ENV
    expect(() => parseEnv(rest)).toThrow(/AI_PROVIDER/)
  })

  it('throws when AI_PROVIDER is not a supported value', () => {
    expect(() => parseEnv({ ...VALID_ENV, AI_PROVIDER: 'gemini' })).toThrow(/AI_PROVIDER/)
  })

  it('throws when AI_MODEL_QUIZ_GENERATION is missing', () => {
    const { AI_MODEL_QUIZ_GENERATION: _, ...rest } = VALID_ENV
    expect(() => parseEnv(rest)).toThrow(/AI_MODEL_QUIZ_GENERATION/)
  })

  it('throws when any per-task model ID is missing', () => {
    for (const key of [
      'AI_MODEL_ANSWER_VERIFICATION',
      'AI_MODEL_DOMAIN_TAGGING',
      'AI_MODEL_AGENT_QA',
      'AI_MODEL_CERTIFICATION_PREFILL',
      'AI_MODEL_MATERIAL_GENERATION',
      'AI_MODEL_COMPLEX_REASONING',
    ] as const) {
      const rest = { ...VALID_ENV }
      delete (rest as Record<string, unknown>)[key]
      expect(() => parseEnv(rest)).toThrow(new RegExp(key))
    }
  })

  it('resolves token budget defaults when overrides are absent', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.AI_MAX_TOKENS_QUIZ_GENERATION).toBe(1024)
    expect(result.AI_MAX_TOKENS_ANSWER_VERIFICATION).toBe(512)
    expect(result.AI_MAX_TOKENS_DOMAIN_TAGGING).toBe(256)
    expect(result.AI_MAX_TOKENS_AGENT_QA).toBe(2048)
    expect(result.AI_MAX_TOKENS_CERTIFICATION_PREFILL).toBe(4096)
    expect(result.AI_MAX_TOKENS_MATERIAL_GENERATION).toBe(4096)
    expect(result.AI_MAX_TOKENS_COMPLEX_REASONING).toBe(8192)
  })

  it('accepts per-task token budget overrides', () => {
    const result = parseEnv({ ...VALID_ENV, AI_MAX_TOKENS_QUIZ_GENERATION: '512' })
    expect(result.AI_MAX_TOKENS_QUIZ_GENERATION).toBe(512)
  })

  it('resolves embedding defaults when overrides are absent', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.AI_EMBEDDING_PROVIDER).toBe('openai')
    expect(result.AI_EMBEDDING_MODEL).toBe('text-embedding-3-small')
    expect(result.AI_EMBEDDING_API_KEY).toBeUndefined()
  })

  it('resolves cache TTL default of 86400 when override is absent', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.AI_RESPONSE_CACHE_TTL_SECONDS).toBe(86_400)
  })

  it('accepts a cache TTL override', () => {
    const result = parseEnv({ ...VALID_ENV, AI_RESPONSE_CACHE_TTL_SECONDS: '3600' })
    expect(result.AI_RESPONSE_CACHE_TTL_SECONDS).toBe(3600)
  })

  it('AI_API_KEY is optional in non-production', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.AI_API_KEY).toBeUndefined()
  })

  it('AI_API_KEY is required in production and throws when missing', () => {
    expect(() => parseEnv({ ...VALID_ENV, NODE_ENV: 'production' })).toThrow(/AI_API_KEY/)
  })

  it('env schema has no AI_EMBEDDING_DIMENSION variable', () => {
    const parsed = parseEnv(VALID_ENV)
    expect('AI_EMBEDDING_DIMENSION' in parsed).toBe(false)
  })
})

describe('env schema — grounding group', () => {
  it('resolves GROUNDING_MAX_REGEN_ATTEMPTS default of 3 when omitted', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.GROUNDING_MAX_REGEN_ATTEMPTS).toBe(3)
  })

  it('accepts a GROUNDING_MAX_REGEN_ATTEMPTS override', () => {
    const result = parseEnv({ ...VALID_ENV, GROUNDING_MAX_REGEN_ATTEMPTS: '5' })
    expect(result.GROUNDING_MAX_REGEN_ATTEMPTS).toBe(5)
  })

  it('throws when GROUNDING_MAX_REGEN_ATTEMPTS is non-numeric', () => {
    expect(() => parseEnv({ ...VALID_ENV, GROUNDING_MAX_REGEN_ATTEMPTS: 'abc' })).toThrow(
      /GROUNDING_MAX_REGEN_ATTEMPTS/,
    )
  })

  it('resolves GROUNDING_VERBATIM_CAP default of 500 when omitted', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.GROUNDING_VERBATIM_CAP).toBe(500)
  })

  it('accepts a GROUNDING_VERBATIM_CAP override', () => {
    const result = parseEnv({ ...VALID_ENV, GROUNDING_VERBATIM_CAP: '300' })
    expect(result.GROUNDING_VERBATIM_CAP).toBe(300)
  })

  it('throws when GROUNDING_VERBATIM_CAP is non-numeric', () => {
    expect(() => parseEnv({ ...VALID_ENV, GROUNDING_VERBATIM_CAP: 'not-a-number' })).toThrow(
      /GROUNDING_VERBATIM_CAP/,
    )
  })

  it('resolves GROUNDING_SIMILARITY_THRESHOLD default of 0.75 when omitted', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.GROUNDING_SIMILARITY_THRESHOLD).toBe(0.75)
  })

  it('accepts a GROUNDING_SIMILARITY_THRESHOLD override', () => {
    const result = parseEnv({ ...VALID_ENV, GROUNDING_SIMILARITY_THRESHOLD: '0.8' })
    expect(result.GROUNDING_SIMILARITY_THRESHOLD).toBe(0.8)
  })

  it('throws when GROUNDING_SIMILARITY_THRESHOLD is non-numeric', () => {
    expect(() =>
      parseEnv({ ...VALID_ENV, GROUNDING_SIMILARITY_THRESHOLD: 'not-a-number' }),
    ).toThrow(/GROUNDING_SIMILARITY_THRESHOLD/)
  })
})

describe('env schema — cert coverage thresholds', () => {
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

describe('env schema — readiness', () => {
  it('READINESS_CALIBRATION_MIN_ANSWERS defaults to 10', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.READINESS_CALIBRATION_MIN_ANSWERS).toBe(10)
  })

  it('accepts a READINESS_CALIBRATION_MIN_ANSWERS override', () => {
    const result = parseEnv({ ...VALID_ENV, READINESS_CALIBRATION_MIN_ANSWERS: '25' })
    expect(result.READINESS_CALIBRATION_MIN_ANSWERS).toBe(25)
  })

  it('rejects non-positive READINESS_CALIBRATION_MIN_ANSWERS', () => {
    expect(() => parseEnv({ ...VALID_ENV, READINESS_CALIBRATION_MIN_ANSWERS: '0' })).toThrow(
      /READINESS_CALIBRATION_MIN_ANSWERS/,
    )
  })

  it('rejects a non-integer READINESS_CALIBRATION_MIN_ANSWERS', () => {
    expect(() => parseEnv({ ...VALID_ENV, READINESS_CALIBRATION_MIN_ANSWERS: '3.5' })).toThrow(
      /READINESS_CALIBRATION_MIN_ANSWERS/,
    )
  })
})

describe('env schema — diagnostic', () => {
  it('DIAGNOSTIC_QUESTION_COUNT defaults to 12', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.DIAGNOSTIC_QUESTION_COUNT).toBe(12)
  })

  it('accepts a DIAGNOSTIC_QUESTION_COUNT override (e.g. 15)', () => {
    const result = parseEnv({ ...VALID_ENV, DIAGNOSTIC_QUESTION_COUNT: '15' })
    expect(result.DIAGNOSTIC_QUESTION_COUNT).toBe(15)
  })

  it('rejects DIAGNOSTIC_QUESTION_COUNT when non-numeric', () => {
    expect(() => parseEnv({ ...VALID_ENV, DIAGNOSTIC_QUESTION_COUNT: 'abc' })).toThrow(
      /DIAGNOSTIC_QUESTION_COUNT/,
    )
  })

  it('DIAGNOSTIC_REPROMPT_AFTER_SESSIONS defaults to 1', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.DIAGNOSTIC_REPROMPT_AFTER_SESSIONS).toBe(1)
  })

  it('accepts a DIAGNOSTIC_REPROMPT_AFTER_SESSIONS override (e.g. 3)', () => {
    const result = parseEnv({ ...VALID_ENV, DIAGNOSTIC_REPROMPT_AFTER_SESSIONS: '3' })
    expect(result.DIAGNOSTIC_REPROMPT_AFTER_SESSIONS).toBe(3)
  })

  it('rejects DIAGNOSTIC_REPROMPT_AFTER_SESSIONS when non-numeric', () => {
    expect(() => parseEnv({ ...VALID_ENV, DIAGNOSTIC_REPROMPT_AFTER_SESSIONS: 'abc' })).toThrow(
      /DIAGNOSTIC_REPROMPT_AFTER_SESSIONS/,
    )
  })
})

describe('env schema — lifecycle email', () => {
  it('EXAM_READY_THRESHOLD defaults to 80', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.EXAM_READY_THRESHOLD).toBe(80)
  })

  it('accepts an EXAM_READY_THRESHOLD override of 75', () => {
    const result = parseEnv({ ...VALID_ENV, EXAM_READY_THRESHOLD: '75' })
    expect(result.EXAM_READY_THRESHOLD).toBe(75)
  })

  it('rejects an EXAM_READY_THRESHOLD above 100', () => {
    expect(() => parseEnv({ ...VALID_ENV, EXAM_READY_THRESHOLD: '101' })).toThrow(
      /EXAM_READY_THRESHOLD/,
    )
  })

  it('NUDGE_MAX_FOLLOWUPS defaults to 1', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.NUDGE_MAX_FOLLOWUPS).toBe(1)
  })

  it('exposes scheduling defaults when overrides are absent', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.DIGEST_SEND_WEEKDAY).toBeTypeOf('number')
    expect(result.DIGEST_SEND_HOUR).toBeTypeOf('number')
    expect(result.NUDGE_ACTIVITY_LULL_DAYS).toBeTypeOf('number')
    expect(result.NUDGE_FOLLOWUP_DELAY_DAYS).toBeTypeOf('number')
  })

  it('coerces DIGEST_SEND_HOUR to a number', () => {
    const result = parseEnv({ ...VALID_ENV, DIGEST_SEND_HOUR: '8' })
    expect(result.DIGEST_SEND_HOUR).toBe(8)
  })

  it('fails fast naming DIGEST_SEND_HOUR when it is not a number', () => {
    expect(() => parseEnv({ ...VALID_ENV, DIGEST_SEND_HOUR: 'not-a-number' })).toThrow(
      /DIGEST_SEND_HOUR/,
    )
  })

  it('rejects an out-of-range DIGEST_SEND_WEEKDAY', () => {
    expect(() => parseEnv({ ...VALID_ENV, DIGEST_SEND_WEEKDAY: '7' })).toThrow(
      /DIGEST_SEND_WEEKDAY/,
    )
  })

  it('exposes PUBLIC_API_URL', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.PUBLIC_API_URL).toBe('http://localhost:3001')
  })

  it('throws when PUBLIC_API_URL is missing', () => {
    const { PUBLIC_API_URL: _, ...rest } = VALID_ENV
    expect(() => parseEnv(rest)).toThrow(/PUBLIC_API_URL/)
  })

  it('throws when INTERNAL_API_SECRET is empty', () => {
    expect(() => parseEnv({ ...VALID_ENV, INTERNAL_API_SECRET: '' })).toThrow(
      /INTERNAL_API_SECRET/,
    )
  })
})
