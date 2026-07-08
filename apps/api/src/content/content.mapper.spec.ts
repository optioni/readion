import { ContentSource } from '@readion/db'
import { describe, expect, it } from 'vitest'
import { type IngestionJobView, mapJobToStatus, mapSourceToDto } from './content.mapper'

function buildSource(overrides: Partial<ContentSource> = {}): ContentSource {
  const source = new ContentSource()
  source.id = '11111111-1111-1111-1111-111111111111'
  source.certificationId = '22222222-2222-2222-2222-222222222222'
  source.type = 'web'
  source.url = 'https://docs.aws.amazon.com/whitepaper'
  source.enabled = true
  source.lastFetchedAt = null
  source.recheckIntervalMinutes = 10_080
  source.createdAt = new Date('2026-06-27T10:00:00.000Z')
  Object.assign(source, overrides)
  return source
}

describe('mapSourceToDto', () => {
  it('maps all exposed fields', () => {
    const source = buildSource()
    const dto = mapSourceToDto(source, 0)

    expect(dto).toEqual({
      id: '11111111-1111-1111-1111-111111111111',
      certificationId: '22222222-2222-2222-2222-222222222222',
      type: 'web',
      url: 'https://docs.aws.amazon.com/whitepaper',
      enabled: true,
      lastFetchedAt: null,
      recheckIntervalMinutes: 10_080,
      createdAt: '2026-06-27T10:00:00.000Z',
      chunkCount: 0,
    })
  })

  it('serializes lastFetchedAt to an ISO string when present', () => {
    const source = buildSource({ lastFetchedAt: new Date('2026-06-20T08:30:00.000Z') })
    const dto = mapSourceToDto(source, 0)

    expect(dto.lastFetchedAt).toBe('2026-06-20T08:30:00.000Z')
  })

  it('maps a disabled source', () => {
    const dto = mapSourceToDto(buildSource({ enabled: false }), 0)
    expect(dto.enabled).toBe(false)
  })

  it('passes through a nonzero chunk count', () => {
    const dto = mapSourceToDto(buildSource(), 42)
    expect(dto.chunkCount).toBe(42)
  })
})

describe('mapJobToStatus', () => {
  function buildJob(overrides: Partial<IngestionJobView> = {}): IngestionJobView {
    return {
      id: 'job-1',
      progress: 0,
      attemptsMade: 0,
      timestamp: 1_700_000_000_000,
      ...overrides,
    }
  }

  it('maps a waiting job', () => {
    const status = mapJobToStatus(buildJob(), 'waiting')

    expect(status).toEqual({
      jobId: 'job-1',
      state: 'waiting',
      progress: 0,
      attemptsMade: 0,
      failedReason: null,
      timestamp: 1_700_000_000_000,
      processedOn: null,
      finishedOn: null,
    })
  })

  it('coerces a numeric job id to a string', () => {
    const status = mapJobToStatus(buildJob({ id: '42' }), 'active')
    expect(status.jobId).toBe('42')
  })

  it('surfaces a failed job and its failure reason', () => {
    const status = mapJobToStatus(
      buildJob({
        attemptsMade: 3,
        failedReason: 'boom',
        processedOn: 1_700_000_100_000,
        finishedOn: 1_700_000_200_000,
      }),
      'failed',
    )

    expect(status.state).toBe('failed')
    expect(status.failedReason).toBe('boom')
    expect(status.attemptsMade).toBe(3)
    expect(status.processedOn).toBe(1_700_000_100_000)
    expect(status.finishedOn).toBe(1_700_000_200_000)
  })

  it('defaults progress to 0 when it is not a number', () => {
    const status = mapJobToStatus(buildJob({ progress: { percent: 50 } }), 'active')
    expect(status.progress).toBe(0)
  })

  it('passes a numeric progress through', () => {
    const status = mapJobToStatus(buildJob({ progress: 50 }), 'active')
    expect(status.progress).toBe(50)
  })

  it('maps an unrecognized state to unknown', () => {
    const status = mapJobToStatus(buildJob(), 'stuck')
    expect(status.state).toBe('unknown')
  })

  it('nulls absent timestamps', () => {
    const status = mapJobToStatus({ id: 'job-2', progress: 0, attemptsMade: 0 }, 'delayed')

    expect(status.timestamp).toBeNull()
    expect(status.processedOn).toBeNull()
    expect(status.finishedOn).toBeNull()
  })
})
