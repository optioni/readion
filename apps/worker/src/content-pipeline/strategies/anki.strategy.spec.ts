import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScrapperClient } from '../../scrapper/scrapper.client'
import { ScrapperError } from '../../scrapper/scrapper.errors'
import { AnkiFetchStrategy } from './anki.strategy'

const DECK_URL = 'https://ankiweb.net/shared/info/1234567890'

const DECK_TEXT = `# AWS Certified Cloud Practitioner - Q&A

Sample (from 187 notes)

Front: What is the AWS shared responsibility model?
Back: A framework that divides security obligations between AWS and the customer.

Front: What is an IAM role?
Back: An identity with permissions that can be assumed by trusted entities.
`

describe('AnkiFetchStrategy', () => {
  let strategy: AnkiFetchStrategy
  let scrapper: { fetch: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    scrapper = { fetch: vi.fn() }
    strategy = new AnkiFetchStrategy(scrapper as unknown as ScrapperClient)
  })

  afterEach(() => vi.clearAllMocks())

  it('fetches the public deck page through the scrapper and returns the card text', async () => {
    scrapper.fetch.mockResolvedValue({ content: DECK_TEXT, url: DECK_URL })

    const result = await strategy.fetch(DECK_URL)

    expect(scrapper.fetch).toHaveBeenCalledWith(DECK_URL)
    expect(result.length).toBeGreaterThanOrEqual(2)
    expect(result.every((item) => item.url === DECK_URL)).toBe(true)
    expect(result.some((item) => item.text.includes('shared responsibility model'))).toBe(true)
    expect(result.some((item) => item.text.includes('IAM role'))).toBe(true)
  })

  it('does not attempt any authentication or paywall bypass', async () => {
    scrapper.fetch.mockResolvedValue({ content: DECK_TEXT, url: DECK_URL })

    await strategy.fetch(DECK_URL)

    expect(scrapper.fetch).toHaveBeenCalledTimes(1)
    expect(scrapper.fetch).toHaveBeenCalledWith(DECK_URL)
  })

  it('returns an empty array when the scrapper fails, instead of throwing', async () => {
    scrapper.fetch.mockRejectedValue(new ScrapperError(DECK_URL, 500))

    await expect(strategy.fetch(DECK_URL)).resolves.toEqual([])
  })

  it('returns an empty array when the scrapper content does not look like a deck, rather than emitting garbage', async () => {
    scrapper.fetch.mockResolvedValue({
      content: '<html><body>unexpected markup</body></html>',
      url: DECK_URL,
    })

    const result = await strategy.fetch(DECK_URL)

    expect(result).toEqual([])
  })

  it('returns an empty array for blank scrapper content', async () => {
    scrapper.fetch.mockResolvedValue({ content: '   ', url: DECK_URL })

    const result = await strategy.fetch(DECK_URL)

    expect(result).toEqual([])
  })
})
