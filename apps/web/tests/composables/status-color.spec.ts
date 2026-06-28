import { describe, expect, it } from 'vitest'
import {
  statusBorderColorClass,
  statusColorForScore,
  statusTextColorClass,
} from '~/composables/statusColor'

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

describe('status colour class helpers', () => {
  it('builds the text colour class from a status key', () => {
    expect(statusTextColorClass('good')).toBe('text-readion-status-good')
    expect(statusTextColorClass('poor')).toBe('text-readion-status-poor')
  })

  it('builds the border colour class from a status key', () => {
    expect(statusBorderColorClass('good')).toBe('border-readion-status-good')
    expect(statusBorderColorClass('poor')).toBe('border-readion-status-poor')
  })
})
