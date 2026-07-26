import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { extractDomain, isAllowedByRobots, throttleForDomain, USER_AGENT } from './fetch-etiquette'

describe('fetch-etiquette', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  describe('extractDomain', () => {
    it('returns the hostname of a valid URL', () => {
      expect(extractDomain('https://docs.aws.amazon.com/security')).toBe('docs.aws.amazon.com')
    })

    it('returns the input when URL is invalid', () => {
      expect(extractDomain('not-a-url')).toBe('not-a-url')
    })
  })

  describe('USER_AGENT', () => {
    it('contains a recognizable bot identifier', () => {
      expect(USER_AGENT).toContain('Readion')
      expect(USER_AGENT).toContain('bot')
    })
  })

  describe('isAllowedByRobots', () => {
    it('returns true when robots.txt fetch fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
      const result = await isAllowedByRobots('https://example.com/page')
      expect(result).toBe(true)
    })

    it('returns true when robots.txt fetch rejects with a non-Error value', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue('network unavailable'))
      const result = await isAllowedByRobots('https://example.com/page')
      expect(result).toBe(true)
    })

    it('returns true when robots.txt returns non-OK', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
      const result = await isAllowedByRobots('https://example.com/page')
      expect(result).toBe(true)
    })

    it('returns true when robots.txt has no relevant rules', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          text: () => Promise.resolve('User-agent: *\nAllow: /\n'),
        }),
      )
      const result = await isAllowedByRobots('https://example.com/public')
      expect(result).toBe(true)
    })

    it('returns false when path is disallowed for all agents', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          text: () => Promise.resolve('User-agent: *\nDisallow: /private/\n'),
        }),
      )
      const result = await isAllowedByRobots('https://example.com/private/data')
      expect(result).toBe(false)
    })

    it('returns true when path does not start with the disallowed prefix', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          text: () => Promise.resolve('User-agent: *\nDisallow: /secret/\n'),
        }),
      )
      const result = await isAllowedByRobots('https://example.com/public/docs')
      expect(result).toBe(true)
    })

    it('returns false when Readion-specific agent is disallowed', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          text: () => Promise.resolve('User-agent: Readion-Ingestion\nDisallow: /internal/\n'),
        }),
      )
      const result = await isAllowedByRobots('https://example.com/internal/docs')
      expect(result).toBe(false)
    })
  })

  describe('throttleForDomain', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('does not delay on first call to a domain', async () => {
      const uniqueDomain = `test-domain-${Date.now()}.example.com`
      const start = Date.now()
      await throttleForDomain(uniqueDomain)
      expect(Date.now() - start).toBeLessThan(100)
    })

    it('does not delay a repeat request after the rate-limit window has elapsed', async () => {
      const uniqueDomain = `elapsed-domain-${Date.now()}.example.com`
      const timeoutSpy = vi.spyOn(globalThis, 'setTimeout')

      await throttleForDomain(uniqueDomain)
      vi.advanceTimersByTime(1_000)
      await throttleForDomain(uniqueDomain)

      expect(timeoutSpy).not.toHaveBeenCalled()
    })
  })

  describe('politelyFetch', () => {
    it('throws when URL is disallowed by robots.txt', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          text: () => Promise.resolve('User-agent: *\nDisallow: /blocked/\n'),
        }),
      )

      const { politelyFetch } = await import('./fetch-etiquette')
      await expect(politelyFetch('https://example.com/blocked/page')).rejects.toThrow(
        'disallowed by robots.txt',
      )
    })

    it('fetches with User-Agent header when allowed', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({ ok: false }) // robots.txt not found
        .mockResolvedValueOnce({ ok: true, text: 'ok' }) // actual fetch

      vi.stubGlobal('fetch', fetchMock)

      const { politelyFetch } = await import('./fetch-etiquette')
      await politelyFetch('https://allowed.example.com/page')

      const callArgs = fetchMock.mock.calls[1]
      expect(callArgs[1]?.headers?.['User-Agent']).toContain('Readion')
    })

    it('preserves caller headers alongside the User-Agent header', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ ok: true })

      vi.stubGlobal('fetch', fetchMock)

      const { politelyFetch } = await import('./fetch-etiquette')
      await politelyFetch('https://headers.example.com/page', {
        headers: { Accept: 'text/plain' },
      })

      expect(fetchMock.mock.calls[1]?.[1]?.headers).toEqual({
        Accept: 'text/plain',
        'User-Agent': USER_AGENT,
      })
    })
  })
})
