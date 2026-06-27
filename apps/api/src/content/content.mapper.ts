import type { ContentSource } from '@readion/db'
import {
  type ContentSourceResponse,
  type IngestionJobState,
  type IngestionJobStatus,
  ingestionJobStates,
} from '@readion/shared'

export function mapSourceToDto(source: ContentSource): ContentSourceResponse {
  return {
    id: source.id,
    certificationId: source.certificationId,
    type: source.type,
    url: source.url,
    enabled: source.enabled,
    lastFetchedAt: source.lastFetchedAt?.toISOString() ?? null,
    recheckIntervalMinutes: source.recheckIntervalMinutes,
    createdAt: source.createdAt.toISOString(),
  }
}

export interface IngestionJobView {
  id?: string
  progress?: unknown
  attemptsMade: number
  failedReason?: string | null
  timestamp?: number | null
  processedOn?: number | null
  finishedOn?: number | null
}

function normalizeState(state: string): IngestionJobState {
  return (ingestionJobStates as readonly string[]).includes(state)
    ? (state as IngestionJobState)
    : 'unknown'
}

export function mapJobToStatus(job: IngestionJobView, state: string): IngestionJobStatus {
  return {
    jobId: String(job.id),
    state: normalizeState(state),
    progress: typeof job.progress === 'number' ? job.progress : 0,
    attemptsMade: job.attemptsMade,
    failedReason: job.failedReason ?? null,
    timestamp: job.timestamp ?? null,
    processedOn: job.processedOn ?? null,
    finishedOn: job.finishedOn ?? null,
  }
}
