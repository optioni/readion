import type { CertificationDomain } from '@readion/shared'

export interface DiagnosticDomainSlot {
  domain: string
  difficulty: 'calibration'
}

export interface MockDomainSlot {
  domain: string
  difficulty: 'exam-ready'
}

/**
 * Largest-remainder (Hamilton's) method: distributes `count` across entries
 * proportional to their weights. Returns the entries array with `.count` set.
 * Caller must ensure sum of weights > 0.
 */
export function largestRemainder(
  entries: Array<{ domain: string; weight: number }>,
  count: number,
): Array<{ domain: string; count: number }> {
  const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0)
  const withFractions = entries.map((e) => {
    const raw = (e.weight / totalWeight) * count
    return { domain: e.domain, count: Math.floor(raw), remainder: raw - Math.floor(raw) }
  })
  const totalFloored = withFractions.reduce((sum, e) => sum + e.count, 0)
  let remaining = count - totalFloored
  const sorted = [...withFractions].sort((a, b) => b.remainder - a.remainder)
  for (const entry of sorted) {
    if (remaining <= 0) break
    entry.count++
    remaining--
  }
  return withFractions.map(({ domain, count: c }) => ({ domain, count: c }))
}

/**
 * Breadth planner: every domain gets ≥1 slot (floor), then remaining slots
 * distributed by exam-share weight (largest-remainder).
 * If budget < domainCount, effective budget is clamped up to domainCount.
 */
export function planBreadthSlots(
  domains: CertificationDomain[],
  budget: number,
): DiagnosticDomainSlot[] {
  const effectiveBudget = Math.max(budget, domains.length)
  const remaining = effectiveBudget - domains.length

  const extras = largestRemainder(
    domains.map((d) => ({ domain: d.name, weight: d.weight })),
    remaining,
  )
  const extrasMap = new Map(extras.map((e) => [e.domain, e.count]))

  const slots: DiagnosticDomainSlot[] = []
  for (const d of domains) {
    const total = 1 + (extrasMap.get(d.name) ?? 0)
    for (let i = 0; i < total; i++) {
      slots.push({ domain: d.name, difficulty: 'calibration' })
    }
  }
  return slots
}

/**
 * Proportional mock planner using the same largest-remainder helper.
 * All slots have difficulty 'exam-ready'.
 */
export function planMockSlots(
  domains: CertificationDomain[],
  questionCount: number,
): MockDomainSlot[] {
  const allocated = largestRemainder(
    domains.map((d) => ({ domain: d.name, weight: d.weight })),
    questionCount,
  )
  const slots: MockDomainSlot[] = []
  for (const { domain, count } of allocated) {
    for (let i = 0; i < count; i++) {
      slots.push({ domain, difficulty: 'exam-ready' })
    }
  }
  return slots
}
