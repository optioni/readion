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
}

describe('env schema — session summary group', () => {
  it('SUMMARY_DRILL_MAX_QUESTIONS defaults to 7 when omitted', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.SUMMARY_DRILL_MAX_QUESTIONS).toBe(7)
  })

  it('accepts a SUMMARY_DRILL_MAX_QUESTIONS override', () => {
    const result = parseEnv({ ...VALID_ENV, SUMMARY_DRILL_MAX_QUESTIONS: '10' })
    expect(result.SUMMARY_DRILL_MAX_QUESTIONS).toBe(10)
  })

  it('rejects SUMMARY_DRILL_MAX_QUESTIONS of 0 (must be positive)', () => {
    expect(() => parseEnv({ ...VALID_ENV, SUMMARY_DRILL_MAX_QUESTIONS: '0' })).toThrow(
      /SUMMARY_DRILL_MAX_QUESTIONS/,
    )
  })

  it('rejects non-integer SUMMARY_DRILL_MAX_QUESTIONS', () => {
    expect(() => parseEnv({ ...VALID_ENV, SUMMARY_DRILL_MAX_QUESTIONS: '3.5' })).toThrow(
      /SUMMARY_DRILL_MAX_QUESTIONS/,
    )
  })

  it('SUMMARY_UNSURE_CONFIDENCE_THRESHOLD defaults to 2 when omitted', () => {
    const result = parseEnv(VALID_ENV)
    expect(result.SUMMARY_UNSURE_CONFIDENCE_THRESHOLD).toBe(2)
  })

  it('accepts a SUMMARY_UNSURE_CONFIDENCE_THRESHOLD override within range', () => {
    const result = parseEnv({ ...VALID_ENV, SUMMARY_UNSURE_CONFIDENCE_THRESHOLD: '3' })
    expect(result.SUMMARY_UNSURE_CONFIDENCE_THRESHOLD).toBe(3)
  })

  it('rejects SUMMARY_UNSURE_CONFIDENCE_THRESHOLD of 0 (must be >= 1)', () => {
    expect(() => parseEnv({ ...VALID_ENV, SUMMARY_UNSURE_CONFIDENCE_THRESHOLD: '0' })).toThrow(
      /SUMMARY_UNSURE_CONFIDENCE_THRESHOLD/,
    )
  })

  it('rejects SUMMARY_UNSURE_CONFIDENCE_THRESHOLD of 6 (must be <= 5)', () => {
    expect(() => parseEnv({ ...VALID_ENV, SUMMARY_UNSURE_CONFIDENCE_THRESHOLD: '6' })).toThrow(
      /SUMMARY_UNSURE_CONFIDENCE_THRESHOLD/,
    )
  })
})
