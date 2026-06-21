import { describe, expect, it } from 'vitest'
import { buildThrottlerOptions, THROTTLER_DEFAULTS } from './throttler.config'

describe('buildThrottlerOptions', () => {
  it('uses documented defaults when no overrides are provided', () => {
    const opts = buildThrottlerOptions({
      THROTTLER_AUTH_LIMIT: THROTTLER_DEFAULTS.AUTH_LIMIT,
      THROTTLER_AUTH_TTL: THROTTLER_DEFAULTS.AUTH_TTL,
      THROTTLER_AGENT_LIMIT: THROTTLER_DEFAULTS.AGENT_LIMIT,
      THROTTLER_AGENT_TTL: THROTTLER_DEFAULTS.AGENT_TTL,
      THROTTLER_GENERAL_LIMIT: THROTTLER_DEFAULTS.GENERAL_LIMIT,
      THROTTLER_GENERAL_TTL: THROTTLER_DEFAULTS.GENERAL_TTL,
    })

    const auth = opts.throttlers.find((t) => t.name === 'auth')
    expect(auth?.limit).toBe(10)
    expect(auth?.ttl).toBe(900_000)

    const agent = opts.throttlers.find((t) => t.name === 'agent')
    expect(agent?.limit).toBe(30)
    expect(agent?.ttl).toBe(60_000)

    const general = opts.throttlers.find((t) => t.name === 'general')
    expect(general?.limit).toBe(300)
    expect(general?.ttl).toBe(60_000)
  })

  it('respects overrides', () => {
    const opts = buildThrottlerOptions({
      THROTTLER_AUTH_LIMIT: 5,
      THROTTLER_AUTH_TTL: 300_000,
      THROTTLER_AGENT_LIMIT: THROTTLER_DEFAULTS.AGENT_LIMIT,
      THROTTLER_AGENT_TTL: THROTTLER_DEFAULTS.AGENT_TTL,
      THROTTLER_GENERAL_LIMIT: THROTTLER_DEFAULTS.GENERAL_LIMIT,
      THROTTLER_GENERAL_TTL: THROTTLER_DEFAULTS.GENERAL_TTL,
    })

    const auth = opts.throttlers.find((t) => t.name === 'auth')
    expect(auth?.limit).toBe(5)
    expect(auth?.ttl).toBe(300_000)
  })
})
