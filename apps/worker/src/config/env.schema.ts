import {
  CHUNK_OVERLAP_DEFAULT,
  CHUNK_SIZE_DEFAULT,
  databaseUrlFragment,
  DOMAIN_CONFIDENCE_THRESHOLD_DEFAULT,
  EMBEDDING_DIMENSION,
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

const AI_PROVIDERS = ['anthropic', 'openai'] as const

const envSchema = z.object({
  ...databaseUrlFragment,
  ...redisUrlFragment,
  ...observabilityEnvFragment,
  ...workerPrometheusFragment,
  SCRAPPER_URL: zodRequiredUrl(),
  LIFECYCLE_DELETION_GRACE_DAYS: zodCoerceNumber().default(LIFECYCLE_DELETION_GRACE_DAYS_DEFAULT),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // AI / LLM config
  AI_PROVIDER: z.enum(AI_PROVIDERS).default('openai'),
  AI_API_KEY: z.string().min(1).optional(),
  AI_MODEL_DOMAIN_TAGGING: z.string().min(1).default('gpt-4o-mini'),
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
  CONTENT_RECHECK_QUIZLET_MINUTES: zodCoerceNumber().default(SOURCE_RECHECK_INTERVALS.quizlet),
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
