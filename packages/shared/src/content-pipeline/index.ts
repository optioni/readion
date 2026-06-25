export const contentSourceTypes = [
  'web',
  'pdf',
  'youtube',
  'reddit',
  'github',
  'podcast',
  'anki',
  'quizlet',
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
  quizlet: 43_200,
}
