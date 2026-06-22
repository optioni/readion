import {
  databaseUrlFragment,
  observabilityEnvFragment,
  redisUrlFragment,
  workerPrometheusFragment,
  zodRequiredUrl,
} from '@readion/shared'
import { z } from 'zod'

const envSchema = z.object({
  ...databaseUrlFragment,
  ...redisUrlFragment,
  ...observabilityEnvFragment,
  ...workerPrometheusFragment,
  SCRAPPER_URL: zodRequiredUrl(),
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
