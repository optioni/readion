import {
  aiEnvFragment,
  CERT_REVERIFICATION_INTERVAL_DAYS_DEFAULT,
  DEFAULT_DISPLAY_TIMEZONE,
  DEFAULT_MIN_CHUNKS_PER_DOMAIN,
  DEFAULT_TOTAL_CHUNK_MULTIPLE,
  dbConnectionEnvFragment,
  groundingEnvFragment,
  isSupportedTimeZone,
  LEITNER_EASY_PROMOTION_DEFAULT,
  LEITNER_INTERVALS_DAYS_DEFAULT,
  lifecycleEmailApiEnvFragment,
  observabilityEnvFragment,
  productAnalyticsEnvFragment,
  READINESS_CALIBRATION_MIN_ANSWERS_DEFAULT,
  REVIEW_SESSION_QUESTION_CAP_DEFAULT,
  redisUrlFragment,
  SIMILARITY_THRESHOLD_DEFAULT,
  SUMMARY_DRILL_MAX_QUESTIONS,
  SUMMARY_UNSURE_CONFIDENCE_THRESHOLD,
  zodCoerceBoolean,
  zodCoerceNumber,
  zodRequiredUrl,
} from '@readion/shared'
import { z } from 'zod'

export const AUTH_TTL_DEFAULT = 900_000
export const AUTH_LIMIT_DEFAULT = 10
export const AGENT_TTL_DEFAULT = 60_000
export const AGENT_LIMIT_DEFAULT = 30
export const GENERAL_TTL_DEFAULT = 60_000
export const GENERAL_LIMIT_DEFAULT = 300
export const JWT_ACCESS_TOKEN_EXPIRES_IN_SECONDS_DEFAULT = 900
export const JWT_REFRESH_TOKEN_EXPIRES_IN_SECONDS_DEFAULT = 604_800
export const BCRYPT_COST_DEFAULT = 12
export const LIFECYCLE_DELETION_GRACE_DAYS_DEFAULT = 14
export const AGENT_SEMANTIC_SEARCH_LIMIT_DEFAULT = 8

function parseMailbox(value: string) {
  const displayNameMatch = value.match(/<([^<>]+)>$/)
  return displayNameMatch?.[1] ?? value
}

function isEmailAddress(value: string) {
  return /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(parseMailbox(value))
}

function emptyStringToUndefined(value: unknown) {
  return value === '' ? undefined : value
}

const optionalNonEmptyString = z.preprocess(emptyStringToUndefined, z.string().min(1).optional())
const optionalSmtpPort = z.preprocess(emptyStringToUndefined, zodCoerceNumber().optional())
const smtpFields = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USERNAME', 'SMTP_PASSWORD'] as const
const dbConnectionFields = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'] as const

const envSchema = z
  .object({
    ...dbConnectionEnvFragment,
    ...redisUrlFragment,
    ...observabilityEnvFragment,
    ...aiEnvFragment,
    ...groundingEnvFragment,
    ...lifecycleEmailApiEnvFragment,
    ...productAnalyticsEnvFragment,
    SMTP_HOST: optionalNonEmptyString,
    SMTP_PORT: optionalSmtpPort,
    SMTP_USERNAME: optionalNonEmptyString,
    SMTP_PASSWORD: optionalNonEmptyString,
    MAIL_FROM: z
      .string()
      .min(1)
      .refine(isEmailAddress, { message: 'Must include an email address' }),
    PORT: zodCoerceNumber().default(3001),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    CORS_ORIGIN: zodRequiredUrl().default('http://localhost:3000'),
    JWT_SECRET: z.string().min(1),
    JWT_ACCESS_TOKEN_EXPIRES_IN_SECONDS: zodCoerceNumber().default(
      JWT_ACCESS_TOKEN_EXPIRES_IN_SECONDS_DEFAULT,
    ),
    JWT_REFRESH_TOKEN_EXPIRES_IN_SECONDS: zodCoerceNumber().default(
      JWT_REFRESH_TOKEN_EXPIRES_IN_SECONDS_DEFAULT,
    ),
    WEB_BASE_URL: zodRequiredUrl(),
    BCRYPT_COST: zodCoerceNumber().default(BCRYPT_COST_DEFAULT),
    LIFECYCLE_DELETION_GRACE_DAYS: zodCoerceNumber().default(LIFECYCLE_DELETION_GRACE_DAYS_DEFAULT),
    DEFAULT_DISPLAY_TIMEZONE: z
      .string()
      .refine(isSupportedTimeZone, { message: 'Must be a valid IANA timezone' })
      .default(DEFAULT_DISPLAY_TIMEZONE),
    THROTTLER_AUTH_LIMIT: zodCoerceNumber().default(AUTH_LIMIT_DEFAULT),
    THROTTLER_AUTH_TTL: zodCoerceNumber().default(AUTH_TTL_DEFAULT),
    THROTTLER_AGENT_LIMIT: zodCoerceNumber().default(AGENT_LIMIT_DEFAULT),
    THROTTLER_AGENT_TTL: zodCoerceNumber().default(AGENT_TTL_DEFAULT),
    THROTTLER_GENERAL_LIMIT: zodCoerceNumber().default(GENERAL_LIMIT_DEFAULT),
    THROTTLER_GENERAL_TTL: zodCoerceNumber().default(GENERAL_TTL_DEFAULT),
    DISK_HEALTH_PATH: z.string().default('/'),
    DISK_HEALTH_THRESHOLD: zodCoerceNumber().default(0.9),
    CERT_COVERAGE_MIN_CHUNKS_PER_DOMAIN: zodCoerceNumber()
      .refine((n) => n > 0, { message: 'Must be a positive number' })
      .default(DEFAULT_MIN_CHUNKS_PER_DOMAIN),
    CERT_COVERAGE_TOTAL_CHUNK_MULTIPLE: zodCoerceNumber()
      .refine((n) => n > 0, { message: 'Must be a positive number' })
      .default(DEFAULT_TOTAL_CHUNK_MULTIPLE),
    CERT_REVERIFICATION_INTERVAL_DAYS: zodCoerceNumber()
      .refine((n) => Number.isInteger(n) && n > 0, { message: 'Must be a positive integer' })
      .default(CERT_REVERIFICATION_INTERVAL_DAYS_DEFAULT),
    REVIEW_LEITNER_INTERVALS_DAYS: z
      .string()
      .default(LEITNER_INTERVALS_DAYS_DEFAULT.join(','))
      .transform((raw) => raw.split(',').map((part) => Number(part.trim())))
      .refine((days) => days.length > 0 && days.every((d) => Number.isFinite(d) && d > 0), {
        message: 'Must be a comma-separated list of positive numbers',
      }),
    REVIEW_LEITNER_EASY_PROMOTION: zodCoerceNumber()
      .refine((n) => Number.isInteger(n) && n > 0, { message: 'Must be a positive integer' })
      .default(LEITNER_EASY_PROMOTION_DEFAULT),
    REVIEW_SESSION_QUESTION_CAP: zodCoerceNumber()
      .refine((n) => n > 0, { message: 'Must be a positive number' })
      .default(REVIEW_SESSION_QUESTION_CAP_DEFAULT),
    MOCK_EXAM_NEUTRAL_CONFIDENCE: zodCoerceNumber()
      .refine((n) => n >= 1 && n <= 5, { message: 'Must be between 1 and 5' })
      .default(3),
    MOCK_EXAM_AUTO_SUBMIT_GRACE_SECONDS: zodCoerceNumber()
      .refine((n) => n >= 0, { message: 'Must be a non-negative number' })
      .default(120),
    READINESS_CALIBRATION_MIN_ANSWERS: zodCoerceNumber()
      .refine((n) => Number.isInteger(n) && n > 0, {
        message: 'Must be a positive integer',
      })
      .default(READINESS_CALIBRATION_MIN_ANSWERS_DEFAULT),
    DIAGNOSTIC_QUESTION_COUNT: zodCoerceNumber()
      .refine((n) => Number.isInteger(n) && n >= 10 && n <= 15, {
        message: 'Must be an integer between 10 and 15',
      })
      .default(12),
    DIAGNOSTIC_REPROMPT_AFTER_SESSIONS: zodCoerceNumber()
      .refine((n) => Number.isInteger(n) && n >= 0, {
        message: 'Must be a non-negative integer',
      })
      .default(1),
    SUMMARY_DRILL_MAX_QUESTIONS: zodCoerceNumber()
      .refine((n) => Number.isInteger(n) && n > 0, { message: 'Must be a positive integer' })
      .default(SUMMARY_DRILL_MAX_QUESTIONS),
    SUMMARY_UNSURE_CONFIDENCE_THRESHOLD: zodCoerceNumber()
      .refine((n) => Number.isInteger(n) && n >= 1 && n <= 5, {
        message: 'Must be between 1 and 5',
      })
      .default(SUMMARY_UNSURE_CONFIDENCE_THRESHOLD),
    AGENT_SIMILARITY_THRESHOLD: zodCoerceNumber()
      .refine((n) => n > 0 && n <= 1, { message: 'Must be between 0 and 1' })
      .default(SIMILARITY_THRESHOLD_DEFAULT),
    AGENT_SEMANTIC_SEARCH_LIMIT: zodCoerceNumber()
      .refine((n) => Number.isInteger(n) && n > 0, { message: 'Must be a positive integer' })
      .default(AGENT_SEMANTIC_SEARCH_LIMIT_DEFAULT),
    SIGNUPS_ENABLED: zodCoerceBoolean().default(true),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') {
      return
    }

    for (const field of smtpFields) {
      if (env[field] === undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'Required in production',
          path: [field],
        })
      }
    }

    for (const field of dbConnectionFields) {
      if (env[field] === undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'Required in production',
          path: [field],
        })
      }
    }

    if (env.AI_API_KEY === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'Required in production',
        path: ['AI_API_KEY'],
      })
    }
  })

export type EnvConfig = z.infer<typeof envSchema>

export function parseEnv(env: Record<string, string | undefined>): EnvConfig {
  const result = envSchema.safeParse(env)
  if (!result.success) {
    const fields = result.error.issues.map((i) => i.path.join('.')).join(', ')
    throw new Error(`Invalid environment configuration: ${fields}`)
  }
  return result.data
}
