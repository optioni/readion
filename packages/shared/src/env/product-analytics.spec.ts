import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { productAnalyticsEnvFragment } from './product-analytics'

const schema = z.object(productAnalyticsEnvFragment)

function parse(env: Record<string, string | undefined> = {}) {
  const result = schema.safeParse(env)
  if (!result.success) {
    const fields = result.error.issues.map((i) => i.path.join('.')).join(', ')
    throw new Error(`Invalid: ${fields}`)
  }
  return result.data
}

describe('productAnalyticsEnvFragment', () => {
  it('resolves window/population defaults when omitted', () => {
    const result = parse()
    expect(result.ANALYTICS_ACTIVE_WINDOW_DAYS).toBe(14)
    expect(result.ANALYTICS_ACTIVE_MIN_SESSIONS).toBe(2)
    expect(result.ANALYTICS_NORTHSTAR_WINDOW_DAYS).toBe(28)
  })

  it('exposes numeric cost coefficients with defaults', () => {
    const result = parse()
    expect(result.ANALYTICS_COST_QUIZ).toBeTypeOf('number')
    expect(result.ANALYTICS_COST_MOCK_QUESTION).toBeTypeOf('number')
    expect(result.ANALYTICS_COST_SESSION_ITEM).toBeTypeOf('number')
    expect(result.ANALYTICS_COST_AGENT_MESSAGE).toBeTypeOf('number')
  })

  it('resolves numeric target defaults when omitted', () => {
    const result = parse()
    expect(result.ANALYTICS_TARGET_NORTHSTAR_GAIN).toBe(15)
    expect(result.ANALYTICS_TARGET_SESSIONS_PER_WEEK).toBe(2)
    expect(result.ANALYTICS_TARGET_W4_RETENTION).toBe(0.4)
    expect(result.ANALYTICS_TARGET_COMPLETION_RATE).toBe(0.75)
    expect(result.ANALYTICS_TARGET_AGENT_ENGAGEMENT).toBe(0.5)
    expect(result.ANALYTICS_LLM_COST_BUDGET).toBeTypeOf('number')
  })

  it('coerces string overrides to numbers', () => {
    const result = parse({ ANALYTICS_ACTIVE_WINDOW_DAYS: '21', ANALYTICS_TARGET_W4_RETENTION: '0.5' })
    expect(result.ANALYTICS_ACTIVE_WINDOW_DAYS).toBe(21)
    expect(result.ANALYTICS_TARGET_W4_RETENTION).toBe(0.5)
  })

  it('fails naming the offending var when a window is malformed', () => {
    expect(() => parse({ ANALYTICS_ACTIVE_WINDOW_DAYS: 'not-a-number' })).toThrow(
      /ANALYTICS_ACTIVE_WINDOW_DAYS/,
    )
  })

  it('rejects a non-positive window naming the var', () => {
    expect(() => parse({ ANALYTICS_NORTHSTAR_WINDOW_DAYS: '0' })).toThrow(
      /ANALYTICS_NORTHSTAR_WINDOW_DAYS/,
    )
  })

  it('rejects an out-of-range retention fraction naming the var', () => {
    expect(() => parse({ ANALYTICS_TARGET_W4_RETENTION: '1.5' })).toThrow(
      /ANALYTICS_TARGET_W4_RETENTION/,
    )
  })
})
