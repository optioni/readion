import { describe, expect, it } from 'vitest'
import { buildItemPlan, frontLoadReviewItems } from './session-planner'

describe('frontLoadReviewItems', () => {
  it('prepends due review items as quiz items before new material and reindexes', () => {
    const plan = buildItemPlan({
      durationMinutes: 30,
      contentMix: 'balanced',
      difficulty: 'intermediate',
      targetDomains: ['Security'],
      certificationId: 'cert-1',
    })
    const newMaterialCount = plan.length

    const result = frontLoadReviewItems(plan, [
      { domain: 'Security', anchorChunkId: 'c1' },
      { domain: 'Networking', anchorChunkId: 'c2' },
      { domain: 'Security', anchorChunkId: 'c3' },
      { domain: 'Billing', anchorChunkId: 'c4' },
    ])

    expect(result).toHaveLength(newMaterialCount + 4)
    expect(result.slice(0, 4)).toEqual([
      { index: 0, type: 'quiz', domain: 'Security', anchorChunkId: 'c1' },
      { index: 1, type: 'quiz', domain: 'Networking', anchorChunkId: 'c2' },
      { index: 2, type: 'quiz', domain: 'Security', anchorChunkId: 'c3' },
      { index: 3, type: 'quiz', domain: 'Billing', anchorChunkId: 'c4' },
    ])
    expect(result.map((i) => i.index)).toEqual(result.map((_, i) => i))
    expect(result[4]!.index).toBe(4)
  })

  it('returns the plan unchanged when nothing is due', () => {
    const plan = buildItemPlan({
      durationMinutes: 30,
      contentMix: 'balanced',
      difficulty: 'intermediate',
      targetDomains: ['Security'],
      certificationId: 'cert-1',
    })

    expect(frontLoadReviewItems(plan, [])).toEqual(plan)
  })
})
