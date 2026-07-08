import { z } from 'zod'

export const chunkStates = ['active', 'superseded'] as const
export type ChunkState = (typeof chunkStates)[number]

export const contentSourceTypes = [
  'web',
  'pdf',
  'youtube',
  'reddit',
  'github',
  'podcast',
  'anki',
] as const

export type ContentSourceType = (typeof contentSourceTypes)[number]

export interface DomainTag {
  domain: string
  confidence: number
}

export interface ChunkMetadata {
  startOffsetSeconds?: number
  [key: string]: unknown
}

export const EMBEDDING_DIMENSION = 1536
export const SIMILARITY_THRESHOLD_DEFAULT = 0.75
export const DOMAIN_CONFIDENCE_THRESHOLD_DEFAULT = 0.5
export const CHUNK_SIZE_DEFAULT = 500
export const CHUNK_OVERLAP_DEFAULT = 50

export const SOURCE_RECHECK_INTERVALS: Record<ContentSourceType, number> = {
  web: 10_080,
  pdf: 43_200,
  youtube: 10_080,
  reddit: 1_440,
  github: 20_160,
  podcast: 10_080,
  anki: 43_200,
}

export function ingestionQueueName(type: string): string {
  return `ingestion-${type}`
}

export const registerSourceRequestSchema = z.object({
  certificationId: z.string().uuid(),
  type: z.enum(contentSourceTypes),
  url: z.string().url(),
  recheckIntervalMinutes: z.number().int().positive().optional(),
})
export type RegisterSourceRequest = z.infer<typeof registerSourceRequestSchema>

export interface ContentSourceResponse {
  id: string
  certificationId: string
  type: ContentSourceType
  url: string
  enabled: boolean
  lastFetchedAt: string | null
  recheckIntervalMinutes: number
  createdAt: string
  chunkCount: number
}

export interface EnqueuedJobResponse {
  jobId: string
  contentSourceId: string
  state: string
}

export const ingestionJobStates = [
  'waiting',
  'active',
  'completed',
  'failed',
  'delayed',
  'paused',
  'unknown',
] as const
export type IngestionJobState = (typeof ingestionJobStates)[number]

export interface IngestionJobStatus {
  jobId: string
  state: IngestionJobState
  progress: number
  attemptsMade: number
  failedReason: string | null
  timestamp: number | null
  processedOn: number | null
  finishedOn: number | null
}
