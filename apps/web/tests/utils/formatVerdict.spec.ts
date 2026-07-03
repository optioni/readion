import { describe, expect, it } from 'vitest'
import { formatVerdict } from '~/utils/formatVerdict'

describe('formatVerdict', () => {
  it('formats a passing verdict', () => {
    const result = formatVerdict({ pass: true, score: 0.4, reason: 'Looks correct' })

    expect(result).toEqual({
      label: 'Passed',
      tone: 'good',
      scorePercent: '40%',
      reason: 'Looks correct',
    })
  })

  it('formats a failing verdict', () => {
    const result = formatVerdict({
      pass: false,
      score: 0.2,
      reason: 'The answer key is incorrect',
    })

    expect(result).toEqual({
      label: 'Failed',
      tone: 'poor',
      scorePercent: '20%',
      reason: 'The answer key is incorrect',
    })
  })

  it('formats the minimum score as 0%', () => {
    expect(formatVerdict({ pass: false, score: 0, reason: 'No support found' }).scorePercent).toBe(
      '0%',
    )
  })

  it('formats the maximum score as 100%', () => {
    expect(formatVerdict({ pass: true, score: 1, reason: 'Fully supported' }).scorePercent).toBe(
      '100%',
    )
  })

  it('rounds fractional percentages sensibly', () => {
    expect(
      formatVerdict({ pass: true, score: 0.667, reason: 'Mostly supported' }).scorePercent,
    ).toBe('67%')
  })

  it('passes the reason through unchanged', () => {
    const reason = 'Distractor overlaps with correct answer'

    expect(formatVerdict({ pass: false, score: 0.5, reason }).reason).toBe(reason)
  })
})
