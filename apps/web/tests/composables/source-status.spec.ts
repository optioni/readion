import type { IngestionJobStatus } from '@readion/shared'
import { describe, expect, it } from 'vitest'
import {
  deriveSourceStatus,
  isJobInFlight,
  latestJob,
  sourceStatusLabel,
  sourceStatusTextClass,
} from '~/composables/sourceStatus'

function job(overrides: Partial<IngestionJobStatus> = {}): IngestionJobStatus {
  return {
    jobId: '1',
    state: 'completed',
    progress: 100,
    attemptsMade: 1,
    failedReason: null,
    timestamp: 1,
    processedOn: 1,
    finishedOn: 1,
    ...overrides,
  }
}

describe('deriveSourceStatus', () => {
  it('reports disabled when the source is disabled regardless of job state', () => {
    expect(deriveSourceStatus({ enabled: false }, job({ state: 'active' }))).toBe('disabled')
  })

  it('reports ingesting when the latest job is active', () => {
    expect(deriveSourceStatus({ enabled: true }, job({ state: 'active' }))).toBe('ingesting')
  })

  it('reports ingesting when the latest job is waiting', () => {
    expect(deriveSourceStatus({ enabled: true }, job({ state: 'waiting' }))).toBe('ingesting')
  })

  it('reports error when the latest job failed', () => {
    expect(deriveSourceStatus({ enabled: true }, job({ state: 'failed' }))).toBe('error')
  })

  it('reports active when enabled with a completed job', () => {
    expect(deriveSourceStatus({ enabled: true }, job({ state: 'completed' }))).toBe('active')
  })

  it('reports active when enabled with no jobs', () => {
    expect(deriveSourceStatus({ enabled: true }, null)).toBe('active')
  })
})

describe('latestJob', () => {
  it('returns null for an empty list', () => {
    expect(latestJob([])).toBeNull()
  })

  it('returns the job with the highest timestamp', () => {
    const newest = job({ jobId: 'b', timestamp: 50 })
    expect(
      latestJob([job({ jobId: 'a', timestamp: 10 }), newest, job({ jobId: 'c', timestamp: 5 })]),
    ).toBe(newest)
  })

  it('treats a null timestamp as the oldest', () => {
    const newest = job({ jobId: 'b', timestamp: 1 })
    expect(latestJob([job({ jobId: 'a', timestamp: null }), newest])).toBe(newest)
  })
})

describe('isJobInFlight', () => {
  it('is true for active and waiting jobs', () => {
    expect(isJobInFlight(job({ state: 'active' }))).toBe(true)
    expect(isJobInFlight(job({ state: 'waiting' }))).toBe(true)
  })

  it('is false for terminal or absent jobs', () => {
    expect(isJobInFlight(job({ state: 'completed' }))).toBe(false)
    expect(isJobInFlight(null)).toBe(false)
  })
})

describe('sourceStatusLabel', () => {
  it('maps every status to a human label', () => {
    expect(sourceStatusLabel('disabled')).toBe('Disabled')
    expect(sourceStatusLabel('ingesting')).toBe('Ingesting')
    expect(sourceStatusLabel('error')).toBe('Error')
    expect(sourceStatusLabel('active')).toBe('Active')
  })
})

describe('sourceStatusTextClass', () => {
  it('uses a neutral class for disabled and the status palette otherwise', () => {
    expect(sourceStatusTextClass('disabled')).toBe('text-slate-400')
    expect(sourceStatusTextClass('ingesting')).toBe('text-readion-status-warning')
    expect(sourceStatusTextClass('error')).toBe('text-readion-status-poor')
    expect(sourceStatusTextClass('active')).toBe('text-readion-status-good')
  })
})
