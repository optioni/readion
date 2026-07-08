import { Inject, Injectable, Logger } from '@nestjs/common'
import type { ScrapperClient } from '../../scrapper/scrapper.client'
import { SCRAPPER_CLIENT } from '../../scrapper/scrapper.module'
import { USER_AGENT } from './fetch-etiquette'
import type { FetchedContent, FetchStrategy } from './fetch-strategy.interface'

@Injectable()
export class PdfFetchStrategy implements FetchStrategy {
  private readonly logger = new Logger(PdfFetchStrategy.name)

  constructor(@Inject(SCRAPPER_CLIENT) private readonly scrapper: ScrapperClient) {}

  async fetch(url: string): Promise<FetchedContent[]> {
    try {
      const result = await this.scrapper.fetch(url)
      return [{ text: result.content, url: result.url }]
    } catch (error) {
      this.logger.warn(
        `scrapper failed for PDF, falling back to direct pdf-parse: url=${url} error=${error instanceof Error ? error.message : String(error)}`,
      )
      return this.fallbackToPdfParse(url)
    }
  }

  private async fallbackToPdfParse(url: string): Promise<FetchedContent[]> {
    const response = await globalThis.fetch(url, { headers: { 'User-Agent': USER_AGENT } })
    if (!response.ok) return []

    const buffer = await response.arrayBuffer()
    const { PDFParse } = await import('pdf-parse')
    const uint8 = new Uint8Array(buffer)
    const parser = new PDFParse({ data: uint8 })
    const result = await parser.getText()
    return [{ text: result.text, url }]
  }
}
