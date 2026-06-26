import { describe, expect, it } from 'vitest'
import { planBreadthSlots } from './mock-exam-slot-planner'

const makeDomains = (weights: number[]) =>
  weights.map((weight, i) => ({ name: `domain-${i + 1}`, weight }))

describe('planBreadthSlots', () => {
  it('gives every domain at least one slot', () => {
    const domains = makeDomains([50, 30, 20])
    const slots = planBreadthSlots(domains, 12)
    for (const d of domains) {
      const count = slots.filter((s) => s.domain === d.name).length
      expect(count).toBeGreaterThanOrEqual(1)
    }
  })

  it('total equals budget when budget >= domainCount', () => {
    const domains = makeDomains([50, 30, 20])
    const slots = planBreadthSlots(domains, 12)
    expect(slots).toHaveLength(12)
  })

  it('remaining slots beyond the floor follow exam-share weight by largest remainder', () => {
    // 3 domains with equal weight, budget = 6 → each gets exactly 2
    const domains = makeDomains([1, 1, 1])
    const slots = planBreadthSlots(domains, 6)
    for (const d of domains) {
      expect(slots.filter((s) => s.domain === d.name)).toHaveLength(2)
    }

    // 2 domains: 80% and 20%, budget = 10 → floor 1 each + 8 remaining (8 and 0)
    // domain-1 gets 1+8=9, domain-2 gets 1+0=1? No — 80% of 8 = 6.4 → floor 6 + remainder 0.4
    // 20% of 8 = 1.6 → floor 1 + remainder 0.6 → domain-2 gets the extra slot
    // domain-1: 1+6=7, domain-2: 1+1+1=3
    const domains2 = makeDomains([80, 20])
    const slots2 = planBreadthSlots(domains2, 10)
    expect(slots2.filter((s) => s.domain === 'domain-1')).toHaveLength(7)
    expect(slots2.filter((s) => s.domain === 'domain-2')).toHaveLength(3)
    expect(slots2).toHaveLength(10)
  })

  it('clamps effective budget up to domainCount when budget < domainCount', () => {
    // 5 domains but budget = 3 → effective budget clamps to 5
    const domains = makeDomains([20, 20, 20, 20, 20])
    const slots = planBreadthSlots(domains, 3)
    expect(slots).toHaveLength(5)
    for (const d of domains) {
      expect(slots.filter((s) => s.domain === d.name)).toHaveLength(1)
    }
  })

  it('is deterministic — same inputs produce same outputs', () => {
    const domains = makeDomains([35, 25, 25, 15])
    const a = planBreadthSlots(domains, 12)
    const b = planBreadthSlots(domains, 12)
    expect(a).toEqual(b)
  })

  it('assigns calibration difficulty to all slots', () => {
    const domains = makeDomains([50, 50])
    const slots = planBreadthSlots(domains, 4)
    for (const slot of slots) {
      expect(slot.difficulty).toBe('calibration')
    }
  })

  it('handles a single domain — gets all slots', () => {
    const domains = makeDomains([100])
    const slots = planBreadthSlots(domains, 12)
    expect(slots).toHaveLength(12)
    expect(slots.every((s) => s.domain === 'domain-1')).toBe(true)
  })
})
