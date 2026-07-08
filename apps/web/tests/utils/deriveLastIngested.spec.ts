import type { IngestionJobStatus } from '@readion/shared'
import { describe, expect, it } from 'vitest'
import { lastIngestedTimestamp } from '~/utils/deriveLastIngested'

function job(overrides: Partial<IngestionJobStatus> = {}): IngestionJobStatus {
  return {
    jobId: 'j1',
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

describe('lastIngestedTimestamp', () => {
  it('prefers the source lastFetchedAt when present', () => {
    expect(
      lastIngestedTimestamp(
        { lastFetchedAt: '2026-06-25T08:00:00.000Z' },
        job({ state: 'completed', finishedOn: 999 }),
      ),
    ).toBe('2026-06-25T08:00:00.000Z')
  })

  it('falls back to the latest completed job finishedOn when lastFetchedAt is null', () => {
    expect(lastIngestedTimestamp({ lastFetchedAt: null }, job({ state: 'completed', finishedOn: 1751000000000 }))).toBe(
      1751000000000,
    )
  })

  it('returns null when lastFetchedAt is null and there is no completed job', () => {
    expect(lastIngestedTimestamp({ lastFetchedAt: null }, null)).toBeNull()
  })

  it('returns null when the only job is not completed', () => {
    expect(
      lastIngestedTimestamp({ lastFetchedAt: null }, job({ state: 'active', finishedOn: null })),
    ).toBeNull()
  })
})
