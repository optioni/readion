import type { IngestionJobStatus } from '@readion/shared'
import { type StatusColorKey, statusTextColorClass } from '~/composables/statusColor'

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

// The three live states colour from the shared status palette; a disabled source is neutral and
// has no palette equivalent, so it falls back to a muted slate.
const STATUS_COLOR_KEYS: Record<Exclude<SourceStatus, 'disabled'>, StatusColorKey> = {
  ingesting: 'warning',
  error: 'poor',
  active: 'good',
}

export function sourceStatusTextClass(status: SourceStatus): string {
  if (status === 'disabled') {
    return 'text-slate-400'
  }
  return statusTextColorClass(STATUS_COLOR_KEYS[status])
}
