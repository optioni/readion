import { describe, expect, it } from 'vitest'
import {
  buildDefaultJobOptions,
  DEFAULT_ATTEMPTS,
  DEFAULT_BACKOFF_BASE_MS,
  DEFAULT_REMOVE_ON_COMPLETE_COUNT,
  DEFAULT_REMOVE_ON_FAIL_COUNT,
} from './queue.defaults'

describe('buildDefaultJobOptions', () => {
  describe('Registered queue carries exponential-backoff defaults', () => {
    it('specifies attempts greater than 1', () => {
      const opts = buildDefaultJobOptions()
      expect(opts.attempts).toBe(DEFAULT_ATTEMPTS)
      expect(opts.attempts).toBeGreaterThan(1)
    })

    it('specifies exponential backoff type with non-zero delay', () => {
      const opts = buildDefaultJobOptions()
      expect(opts.backoff).toEqual({
        type: 'exponential',
        delay: DEFAULT_BACKOFF_BASE_MS,
      })
      expect((opts.backoff as { delay: number }).delay).toBeGreaterThan(0)
    })

    it('includes removeOnComplete and removeOnFail retention bounds', () => {
      const opts = buildDefaultJobOptions()
      expect(opts.removeOnComplete).toEqual({ count: DEFAULT_REMOVE_ON_COMPLETE_COUNT })
      expect(opts.removeOnFail).toEqual({ count: DEFAULT_REMOVE_ON_FAIL_COUNT })
    })
  })

  describe('Per-queue overrides are honored', () => {
    it('honors explicit attempts override', () => {
      const opts = buildDefaultJobOptions({ attempts: 5 })
      expect(opts.attempts).toBe(5)
    })

    it('still inherits exponential backoff strategy when attempts overridden', () => {
      const opts = buildDefaultJobOptions({ attempts: 5 })
      expect((opts.backoff as { type: string }).type).toBe('exponential')
    })

    it('honors explicit backoff delay override', () => {
      const opts = buildDefaultJobOptions({ backoffDelayMs: 500 })
      expect((opts.backoff as { type: string; delay: number }).delay).toBe(500)
      expect((opts.backoff as { type: string }).type).toBe('exponential')
    })

    it('honors removeOnComplete override', () => {
      const opts = buildDefaultJobOptions({ removeOnComplete: { count: 10 } })
      expect(opts.removeOnComplete).toEqual({ count: 10 })
    })
  })
})
