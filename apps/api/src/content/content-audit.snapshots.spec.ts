import { ContentSource } from '@readion/db'
import { describe, expect, it } from 'vitest'
import {
  enabledChangeSnapshot,
  reingestSnapshot,
  sourceAddedSnapshot,
} from './content-audit.snapshots'

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

describe('sourceAddedSnapshot', () => {
  it('builds a non-null after snapshot of the created source', () => {
    const after = sourceAddedSnapshot(buildSource())

    expect(after).toEqual({
      id: '11111111-1111-1111-1111-111111111111',
      certificationId: '22222222-2222-2222-2222-222222222222',
      type: 'web',
      url: 'https://docs.aws.amazon.com/whitepaper',
      enabled: true,
      lastFetchedAt: null,
      recheckIntervalMinutes: 10_080,
      createdAt: '2026-06-27T10:00:00.000Z',
    })
  })
})

describe('enabledChangeSnapshot', () => {
  it('builds the disable before/after pair', () => {
    expect(enabledChangeSnapshot(true, false)).toEqual({
      before: { enabled: true },
      after: { enabled: false },
    })
  })

  it('builds the enable before/after pair', () => {
    expect(enabledChangeSnapshot(false, true)).toEqual({
      before: { enabled: false },
      after: { enabled: true },
    })
  })
})

describe('reingestSnapshot', () => {
  it('builds an after snapshot containing the jobId', () => {
    expect(reingestSnapshot('job-1')).toEqual({ jobId: 'job-1' })
  })
})
