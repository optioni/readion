import {
  databaseUrlFragment,
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

const envSchema = z.object({
  ...databaseUrlFragment,
  ...redisUrlFragment,
  PORT: zodCoerceNumber().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: zodRequiredUrl().default('http://localhost:3000'),
  THROTTLER_AUTH_LIMIT: zodCoerceNumber().default(AUTH_LIMIT_DEFAULT),
  THROTTLER_AUTH_TTL: zodCoerceNumber().default(AUTH_TTL_DEFAULT),
  THROTTLER_AGENT_LIMIT: zodCoerceNumber().default(AGENT_LIMIT_DEFAULT),
  THROTTLER_AGENT_TTL: zodCoerceNumber().default(AGENT_TTL_DEFAULT),
  THROTTLER_GENERAL_LIMIT: zodCoerceNumber().default(GENERAL_LIMIT_DEFAULT),
  THROTTLER_GENERAL_TTL: zodCoerceNumber().default(GENERAL_TTL_DEFAULT),
  DISK_HEALTH_PATH: z.string().default('/'),
  DISK_HEALTH_THRESHOLD: zodCoerceNumber().default(0.9),
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
