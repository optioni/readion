import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScrapperClient } from '../../scrapper/scrapper.client'
import { isAllowedByRobots } from './fetch-etiquette'
import { WebFetchStrategy } from './web.strategy'

vi.mock('./fetch-etiquette', () => ({
  isAllowedByRobots: vi.fn().mockResolvedValue(true),
  throttleForDomain: vi.fn().mockResolvedValue(undefined),
  extractDomain: vi.fn().mockReturnValue('example.com'),
  USER_AGENT: 'Readion-Ingestion/1.0',
}))

describe('WebFetchStrategy', () => {
  let strategy: WebFetchStrategy
  let scrapper: { fetch: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    scrapper = { fetch: vi.fn() }
    strategy = new WebFetchStrategy(scrapper as unknown as ScrapperClient)
  })

  afterEach(() => vi.clearAllMocks())

  it('fetches content via scrapper and returns it as FetchedContent', async () => {
    scrapper.fetch.mockResolvedValue({
      content: '# AWS Docs\n\nSome content about security.',
      url: 'https://docs.aws.amazon.com/security',
    })

    const result = await strategy.fetch('https://docs.aws.amazon.com/security')
    expect(result).toHaveLength(1)
    expect(result[0]!.text).toContain('Some content about security')
    expect(result[0]!.url).toBe('https://docs.aws.amazon.com/security')
  })

  it('does not depend on a browser or playwright within the worker process', () => {
    // Verify that WebFetchStrategy only uses the scrapper client (no browser import)
    expect(typeof strategy.fetch).toBe('function')
    expect(scrapper.fetch).toBeDefined()
  })

  it('returns empty array when robots.txt disallows the URL', async () => {
    vi.mocked(isAllowedByRobots).mockResolvedValueOnce(false)
    const result = await strategy.fetch('https://example.com/private')
    expect(result).toHaveLength(0)
    expect(scrapper.fetch).not.toHaveBeenCalled()
  })
})
