import { describe, expect, it } from 'vitest'
import { useDomainScores } from '~/composables/useDomainScores'
import type {
  CertificationDomainDto,
  SessionSummaryResponseDto,
  WeakAreaResponseDto,
} from '~~/src/api/model'

const domain = (name: string, weight = 0.25): CertificationDomainDto => ({ name, weight })

const weakArea = (overrides: { domain: string; score: number }): WeakAreaResponseDto => ({
  id: overrides.domain,
  domain: overrides.domain,
  score: overrides.score,
  accuracy: 0,
  meanConfidence: 0,
  responseCount: 0,
})

const makeSummary = (
  deltas: Array<{ domain: string; delta: number }>,
): SessionSummaryResponseDto => ({
  questionsAnswered: 10,
  accuracy: 80,
  domains: [],
  weakAreaDeltas: deltas,
  readiness: { before: null, after: null, delta: null },
})

describe('useDomainScores', () => {
  it('produces one row per certification domain preserving cert-domain order', () => {
    const rows = useDomainScores(
      [domain('Networking'), domain('Security'), domain('Storage')],
      [weakArea({ domain: 'Security', score: 61 })],
      null,
    )

    expect(rows.map((r) => r.domain)).toEqual(['Networking', 'Security', 'Storage'])
  })

  it('attaches status colour from the base joinDomainScores logic', () => {
    const [poor, , , good] = useDomainScores(
      [domain('A'), domain('B'), domain('C'), domain('D')],
      [
        weakArea({ domain: 'A', score: 40 }),
        weakArea({ domain: 'B', score: 60 }),
        weakArea({ domain: 'C', score: 75 }),
        weakArea({ domain: 'D', score: 90 }),
      ],
      null,
    )

    expect(poor!.status).toBe('poor')
    expect(good!.status).toBe('good')
  })

  it('sets delta: null for all domains when no latest summary is provided', () => {
    const rows = useDomainScores(
      [domain('Networking'), domain('Security')],
      [weakArea({ domain: 'Security', score: 61 })],
      null,
    )

    expect(rows.every((r) => r.delta === null)).toBe(true)
  })

  it('attaches the signed delta from the latest summary weakAreaDeltas when present', () => {
    const summary = makeSummary([
      { domain: 'Networking', delta: 7 },
      { domain: 'Security', delta: -3 },
    ])
    const rows = useDomainScores(
      [domain('Networking'), domain('Security'), domain('Storage')],
      [weakArea({ domain: 'Networking', score: 72 }), weakArea({ domain: 'Security', score: 55 })],
      summary,
    )

    expect(rows[0]!.delta).toBe(7)
    expect(rows[1]!.delta).toBe(-3)
    expect(rows[2]!.delta).toBe(null)
  })

  it('sets delta: null for a domain absent from weakAreaDeltas even with a summary', () => {
    const summary = makeSummary([{ domain: 'Security', delta: 5 }])
    const rows = useDomainScores(
      [domain('Networking'), domain('Security')],
      [weakArea({ domain: 'Networking', score: 70 }), weakArea({ domain: 'Security', score: 60 })],
      summary,
    )

    expect(rows[0]!.delta).toBe(null)
    expect(rows[1]!.delta).toBe(5)
  })

  it('keeps the "no data yet" state for domains with no weak-area record', () => {
    const [row] = useDomainScores([domain('Networking')], [], null)

    expect(row!.hasData).toBe(false)
    expect(row!.score).toBe(null)
    expect(row!.status).toBe(null)
    expect(row!.delta).toBe(null)
  })

  it('keeps the existing joinDomainScores tests green — correct score and status', () => {
    const rows = useDomainScores(
      [domain('A'), domain('B'), domain('C'), domain('D')],
      [
        weakArea({ domain: 'A', score: 40 }),
        weakArea({ domain: 'B', score: 60 }),
        weakArea({ domain: 'C', score: 75 }),
        weakArea({ domain: 'D', score: 90 }),
      ],
      null,
    )

    expect(rows[0]).toMatchObject({
      domain: 'A',
      score: 40,
      status: 'poor',
      hasData: true,
      delta: null,
    })
    expect(rows[1]).toMatchObject({
      domain: 'B',
      score: 60,
      status: 'warning',
      hasData: true,
      delta: null,
    })
    expect(rows[2]).toMatchObject({
      domain: 'C',
      score: 75,
      status: 'medium',
      hasData: true,
      delta: null,
    })
    expect(rows[3]).toMatchObject({
      domain: 'D',
      score: 90,
      status: 'good',
      hasData: true,
      delta: null,
    })
  })
})
