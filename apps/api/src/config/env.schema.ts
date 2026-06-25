import {
  aiEnvFragment,
  DEFAULT_DISPLAY_TIMEZONE,
  DEFAULT_MIN_CHUNKS_PER_DOMAIN,
  DEFAULT_TOTAL_CHUNK_MULTIPLE,
  databaseUrlFragment,
  groundingEnvFragment,
  isSupportedTimeZone,
  observabilityEnvFragment,
  redisUrlFragment,
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

const envSchema = z
  .object({
    ...databaseUrlFragment,
    ...redisUrlFragment,
    ...observabilityEnvFragment,
    ...aiEnvFragment,
    ...groundingEnvFragment,
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
