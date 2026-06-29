import type { IngestionJobStatus } from '@readion/shared'

export type SourceStatus = 'disabled' | 'ingesting' | 'error' | 'active'

export function latestJob(jobs: IngestionJobStatus[]): IngestionJobStatus | null {
  if (jobs.length === 0) {
    return null
  }
  return jobs.reduce((latest, job) =>
    (job.timestamp ?? 0) >= (latest.timestamp ?? 0) ? job : latest,
  )
}

export function isJobInFlight(job: IngestionJobStatus | null): boolean {
  return job?.state === 'active' || job?.state === 'waiting'
}

export function deriveSourceStatus(
  source: { enabled: boolean },
  job: IngestionJobStatus | null,
): SourceStatus {
  if (!source.enabled) {
    return 'disabled'
  }
  if (isJobInFlight(job)) {
    return 'ingesting'
  }
  if (job?.state === 'failed') {
    return 'error'
  }
  return 'active'
}

const STATUS_LABELS: Record<SourceStatus, string> = {
  disabled: 'Disabled',
  ingesting: 'Ingesting',
  error: 'Error',
  active: 'Active',
}

export function sourceStatusLabel(status: SourceStatus): string {
  return STATUS_LABELS[status]
}

const STATUS_TEXT_CLASSES: Record<SourceStatus, string> = {
  disabled: 'text-slate-400',
  ingesting: 'text-readion-status-warning',
  error: 'text-readion-status-poor',
  active: 'text-readion-status-good',
}

export function sourceStatusTextClass(status: SourceStatus): string {
  return STATUS_TEXT_CLASSES[status]
}
