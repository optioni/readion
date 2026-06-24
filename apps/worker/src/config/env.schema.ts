import {
  databaseUrlFragment,
  observabilityEnvFragment,
  redisUrlFragment,
  workerPrometheusFragment,
  zodCoerceNumber,
  zodRequiredUrl,
} from '@readion/shared'
import { z } from 'zod'

export const LIFECYCLE_DELETION_GRACE_DAYS_DEFAULT = 14

const envSchema = z.object({
  ...databaseUrlFragment,
  ...redisUrlFragment,
  ...observabilityEnvFragment,
  ...workerPrometheusFragment,
  SCRAPPER_URL: zodRequiredUrl(),
  LIFECYCLE_DELETION_GRACE_DAYS: zodCoerceNumber().default(LIFECYCLE_DELETION_GRACE_DAYS_DEFAULT),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

export type WorkerEnvConfig = z.infer<typeof envSchema>

export function parseEnv(env: Record<string, string | undefined>): WorkerEnvConfig {
  const result = envSchema.safeParse(env)
  if (!result.success) {
    const fields = result.error.issues.map((i) => i.path.join('.')).join(', ')
    throw new Error(`Invalid environment configuration: ${fields}`)
  }
  return result.data
}
