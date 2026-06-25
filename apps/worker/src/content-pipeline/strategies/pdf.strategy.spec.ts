import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScrapperClient } from '../../scrapper/scrapper.client'
import { ScrapperError } from '../../scrapper/scrapper.errors'
import { PdfFetchStrategy } from './pdf.strategy'

const mockGetText = vi.fn().mockResolvedValue({ text: 'Extracted PDF text content' })

vi.mock('pdf-parse', () => {
  function MockPDFParse(_opts: unknown) {
    return { getText: mockGetText }
  }
  return { PDFParse: MockPDFParse }
})

describe('PdfFetchStrategy', () => {
  let strategy: PdfFetchStrategy
  let scrapper: { fetch: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    scrapper = { fetch: vi.fn() }
    strategy = new PdfFetchStrategy(scrapper as unknown as ScrapperClient)
  })

  it('returns scrapper content when scrapper succeeds', async () => {
    scrapper.fetch.mockResolvedValue({
      content: 'PDF content from scrapper',
      url: 'https://example.com/guide.pdf',
    })

    const result = await strategy.fetch('https://example.com/guide.pdf')
    expect(result).toHaveLength(1)
    expect(result[0]!.text).toBe('PDF content from scrapper')
  })

  it('falls back to pdf-parse when scrapper fails', async () => {
    scrapper.fetch.mockRejectedValue(new ScrapperError('https://example.com/guide.pdf', 500))

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      }),
    )

    const result = await strategy.fetch('https://example.com/guide.pdf')
    expect(result).toHaveLength(1)
    expect(result[0]!.text).toBe('Extracted PDF text content')
  })
})
