import type { ContentSourceResponse, IngestionJobStatus } from '@readion/shared'

export function lastIngestedTimestamp(
  source: Pick<ContentSourceResponse, 'lastFetchedAt'>,
  job: IngestionJobStatus | null,
): string | number | null {
  if (source.lastFetchedAt) {
    return source.lastFetchedAt
  }
  if (job?.state === 'completed' && job.finishedOn != null) {
    return job.finishedOn
  }
  return null
}
