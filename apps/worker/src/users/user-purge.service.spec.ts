import { describe, expect, it } from 'vitest'
import { isEligibleForHardPurge, purgeCutoff } from './user-purge.service'

describe('user hard-purge eligibility', () => {
  const now = new Date('2026-06-24T12:00:00.000Z')

  it('calculates the cutoff from the injected clock and grace days', () => {
    expect(purgeCutoff(now, 14)).toEqual(new Date('2026-06-10T12:00:00.000Z'))
  })

  it('selects only users deleted before the cutoff', () => {
    expect(isEligibleForHardPurge(new Date('2026-06-10T11:59:59.999Z'), now, 14)).toBe(true)
    expect(isEligibleForHardPurge(new Date('2026-06-10T12:00:00.000Z'), now, 14)).toBe(false)
    expect(isEligibleForHardPurge(new Date('2026-06-11T12:00:00.000Z'), now, 14)).toBe(false)
    expect(isEligibleForHardPurge(null, now, 14)).toBe(false)
  })
})
