import { describe, expect, it } from 'vitest'
import { joinDomainScores } from '~/composables/domainScores'
import type { CertificationDomainDto, WeakAreaResponseDto } from '~~/src/api/model'

const domain = (name: string, weight = 0.25): CertificationDomainDto => ({ name, weight })

const weakArea = (overrides: { domain: string; score: number }): WeakAreaResponseDto => ({
  id: overrides.domain,
  domain: overrides.domain,
  score: overrides.score,
  accuracy: 0,
  meanConfidence: 0,
  responseCount: 0,
})

describe('joinDomainScores', () => {
  it('produces one row per certification domain in cert-domain order', () => {
    const rows = joinDomainScores(
      [domain('Networking'), domain('Security'), domain('Storage')],
      [weakArea({ domain: 'Security', score: 61 })],
    )
    expect(rows.map((r) => r.domain)).toEqual(['Networking', 'Security', 'Storage'])
  })

  it('joins a matching weak-area score and derives its status colour', () => {
    const [poor, warning, medium, good] = joinDomainScores(
      [domain('A'), domain('B'), domain('C'), domain('D')],
      [
        weakArea({ domain: 'A', score: 40 }),
        weakArea({ domain: 'B', score: 60 }),
        weakArea({ domain: 'C', score: 75 }),
        weakArea({ domain: 'D', score: 90 }),
      ],
    )
    expect(poor).toEqual({ domain: 'A', score: 40, status: 'poor', hasData: true })
    expect(warning).toEqual({ domain: 'B', score: 60, status: 'warning', hasData: true })
    expect(medium).toEqual({ domain: 'C', score: 75, status: 'medium', hasData: true })
    expect(good).toEqual({ domain: 'D', score: 90, status: 'good', hasData: true })
  })

  it('renders a "no data yet" state for a domain without a weak-area record', () => {
    const [row] = joinDomainScores([domain('Networking')], [])
    expect(row).toEqual({ domain: 'Networking', score: null, status: null, hasData: false })
  })
})
