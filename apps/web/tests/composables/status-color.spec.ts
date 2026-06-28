import { describe, expect, it } from 'vitest'
import { statusColorForScore } from '~/composables/statusColor'

describe('statusColorForScore', () => {
  it.each([
    [0, 'poor'],
    [48, 'poor'],
    [49, 'poor'],
    [50, 'warning'],
    [61, 'warning'],
    [64, 'warning'],
    [65, 'medium'],
    [70, 'medium'],
    [80, 'medium'],
    [81, 'good'],
    [100, 'good'],
  ] as const)('maps score %i to status key %s', (score, expected) => {
    expect(statusColorForScore(score)).toBe(expected)
  })
})
