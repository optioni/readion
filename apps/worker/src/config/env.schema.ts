import {
  CERT_REVERIFICATION_INTERVAL_DAYS_DEFAULT,
  CHUNK_OVERLAP_DEFAULT,
  CHUNK_SIZE_DEFAULT,
  DEFAULT_MIN_CHUNKS_PER_DOMAIN,
  DEFAULT_TOTAL_CHUNK_MULTIPLE,
  DOMAIN_CONFIDENCE_THRESHOLD_DEFAULT,
  dbConnectionEnvFragment,
  EMBEDDING_DIMENSION,
  lifecycleEmailWorkerEnvFragment,
  observabilityEnvFragment,
  redisUrlFragment,
  SIMILARITY_THRESHOLD_DEFAULT,
  SOURCE_RECHECK_INTERVALS,
  workerPrometheusFragment,
  zodCoerceNumber,
  zodRequiredUrl,
} from '@readion/shared'
import { z } from 'zod'

export const LIFECYCLE_DELETION_GRACE_DAYS_DEFAULT = 14
export const SUPERSEDED_CHUNK_RETENTION_DAYS_DEFAULT = 30
export const SESSION_ABANDONMENT_THRESHOLD_HOURS_DEFAULT = 24
export const AGENT_STANDALONE_TTL_HOURS_DEFAULT = 4

const AI_PROVIDERS = ['anthropic', 'openai'] as const
const dbConnectionFields = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'] as const

const envSchema = z
  .object({
    ...dbConnectionEnvFragment,
    ...redisUrlFragment,
    ...observabilityEnvFragment,
    ...workerPrometheusFragment,
    ...lifecycleEmailWorkerEnvFragment,
    SCRAPPER_URL: zodRequiredUrl(),
    LIFECYCLE_DELETION_GRACE_DAYS: zodCoerceNumber().default(LIFECYCLE_DELETION_GRACE_DAYS_DEFAULT),
    SUPERSEDED_CHUNK_RETENTION_DAYS: zodCoerceNumber().default(
      SUPERSEDED_CHUNK_RETENTION_DAYS_DEFAULT,
    ),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

    // AI / LLM config
    AI_PROVIDER: z.enum(AI_PROVIDERS).default('openai'),
    AI_API_KEY: z.string().min(1).optional(),
    AI_MODEL_DOMAIN_TAGGING: z.string().min(1).default('gpt-4o-mini'),
    AI_MODEL_SESSION_FILL: z.string().min(1).default('gpt-4o'),
    AI_MODEL_CERTIFICATION_PREFILL: z.string().min(1).default('gpt-4o-mini'),
    AI_MODEL_ANSWER_VERIFICATION: z.string().min(1).default('gpt-4o'),
    AI_EMBEDDING_MODEL: z.string().min(1).default('text-embedding-3-small'),
    AI_EMBEDDING_DIMENSION: zodCoerceNumber().default(EMBEDDING_DIMENSION),

    // Content pipeline config
    CONTENT_SIMILARITY_THRESHOLD: zodCoerceNumber().default(SIMILARITY_THRESHOLD_DEFAULT),
    CONTENT_DOMAIN_CONFIDENCE_THRESHOLD: zodCoerceNumber().default(
      DOMAIN_CONFIDENCE_THRESHOLD_DEFAULT,
    ),
    CONTENT_CHUNK_SIZE: zodCoerceNumber().default(CHUNK_SIZE_DEFAULT),
    CONTENT_CHUNK_OVERLAP: zodCoerceNumber().default(CHUNK_OVERLAP_DEFAULT),

    // Per-source-type recheck interval overrides (minutes)
    CONTENT_RECHECK_WEB_MINUTES: zodCoerceNumber().default(SOURCE_RECHECK_INTERVALS.web),
    CONTENT_RECHECK_PDF_MINUTES: zodCoerceNumber().default(SOURCE_RECHECK_INTERVALS.pdf),
    CONTENT_RECHECK_YOUTUBE_MINUTES: zodCoerceNumber().default(SOURCE_RECHECK_INTERVALS.youtube),
    CONTENT_RECHECK_REDDIT_MINUTES: zodCoerceNumber().default(SOURCE_RECHECK_INTERVALS.reddit),
    CONTENT_RECHECK_GITHUB_MINUTES: zodCoerceNumber().default(SOURCE_RECHECK_INTERVALS.github),
    CONTENT_RECHECK_PODCAST_MINUTES: zodCoerceNumber().default(SOURCE_RECHECK_INTERVALS.podcast),
    CONTENT_RECHECK_ANKI_MINUTES: zodCoerceNumber().default(SOURCE_RECHECK_INTERVALS.anki),

    // Session abandonment
    SESSION_ABANDONMENT_THRESHOLD_HOURS: zodCoerceNumber().default(
      SESSION_ABANDONMENT_THRESHOLD_HOURS_DEFAULT,
    ),

    // Standalone agent-conversation inactivity TTL
    AGENT_STANDALONE_TTL_HOURS: zodCoerceNumber().default(AGENT_STANDALONE_TTL_HOURS_DEFAULT),

    // Coverage thresholds for cert go-live promotion
    CERT_COVERAGE_MIN_CHUNKS_PER_DOMAIN: zodCoerceNumber()
      .refine((n) => n > 0, { message: 'Must be a positive number' })
      .default(DEFAULT_MIN_CHUNKS_PER_DOMAIN),
    CERT_COVERAGE_TOTAL_CHUNK_MULTIPLE: zodCoerceNumber()
      .refine((n) => n > 0, { message: 'Must be a positive number' })
      .default(DEFAULT_TOTAL_CHUNK_MULTIPLE),

    // Re-verification surfacing interval for certifications
    CERT_REVERIFICATION_INTERVAL_DAYS: zodCoerceNumber()
      .refine((n) => Number.isInteger(n) && n > 0, { message: 'Must be a positive integer' })
      .default(CERT_REVERIFICATION_INTERVAL_DAYS_DEFAULT),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') {
      return
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
