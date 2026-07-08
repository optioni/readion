import { Inject, Injectable, Logger } from '@nestjs/common'
import type { CertExtractionFields, CertExtractionResult, ExtractedField } from '@readion/shared'
import { isVerbatimPassage } from '@readion/shared'
import { LlmService } from '../../llm/llm.service'
import type { ScrapperClient } from '../../scrapper/scrapper.client'
import { SCRAPPER_CLIENT } from '../../scrapper/scrapper.module'
import { USER_AGENT } from '../strategies/fetch-etiquette'
import type { CertExtractionJobData, FieldProposal } from './cert-extraction.types'

const PDF_FETCH_TIMEOUT_MS = 30_000

@Injectable()
export class CertExtractionService {
  private readonly logger = new Logger(CertExtractionService.name)

  constructor(
    @Inject(SCRAPPER_CLIENT) private readonly scrapper: ScrapperClient,
    private readonly llm: LlmService,
  ) {}

  async extract(data: CertExtractionJobData): Promise<CertExtractionResult> {
    const content = await this.fetchSourceText(data.confirmedSourceUrl)
    if (content.length === 0) {
      this.logger.warn(`cert extraction: empty source text for ${data.confirmedSourceUrl}`)
    }

    const proposals = await this.llm.extractCertFields(content, {
      name: data.name,
      code: data.code,
    })

    const fields: CertExtractionFields = {
      domains: await this.groundField(
        'domains',
        content,
        data.confirmedSourceUrl,
        proposals.domains,
      ),
      questionCount: await this.groundField(
        'questionCount',
        content,
        data.confirmedSourceUrl,
        proposals.questionCount,
      ),
      passingScore: await this.groundField(
        'passingScore',
        content,
        data.confirmedSourceUrl,
        proposals.passingScore,
      ),
      timeLimitMinutes: await this.groundField(
        'timeLimitMinutes',
        content,
        data.confirmedSourceUrl,
        proposals.timeLimitMinutes,
      ),
    }

    const verified = Object.values(fields).filter((field) => !('unverified' in field)).length
    this.logger.log(
      `cert extraction "${data.name}": sourceChars=${content.length} verified=${verified}/4 url=${data.confirmedSourceUrl}`,
    )

    return { fields }
  }

  // A PDF source cannot go through the scrapper — the headless browser downloads
  // it rather than rendering readable DOM, so it 500s. Extract PDF text directly
  // with pdf-parse (as the ingestion pdf strategy does); scrape everything else.
  private async fetchSourceText(url: string): Promise<string> {
    if (/\.pdf($|[?#])/i.test(url)) {
      return this.fetchPdfText(url)
    }
    const { content } = await this.scrapper.fetch(url)
    return content
  }

  private async fetchPdfText(url: string): Promise<string> {
    const response = await globalThis.fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(PDF_FETCH_TIMEOUT_MS),
    })
    if (!response.ok) {
      throw new Error(`PDF fetch failed for ${url}: ${response.status}`)
    }
    const buffer = await response.arrayBuffer()
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    const result = await parser.getText()
    return result.text
  }

  private async groundField<T>(
    field: string,
    sourceText: string,
    url: string,
    proposal: FieldProposal<T> | null,
  ): Promise<ExtractedField<T>> {
    if (proposal === null) {
      this.logger.warn(`cert extraction field ${field}: no proposal from the model`)
      return { unverified: true }
    }

    if (!isVerbatimPassage(sourceText, proposal.passage)) {
      this.logger.warn(
        `cert extraction field ${field}: cited passage not found verbatim in source; passage=${JSON.stringify(proposal.passage.slice(0, 160))}`,
      )
      return { unverified: true }
    }

    const entailed = await this.llm.verifyFieldEntailment(proposal.value, proposal.passage)
    if (!entailed) {
      this.logger.warn(`cert extraction field ${field}: verifier did not entail the value`)
      return { unverified: true }
    }

    return { value: proposal.value, citation: { url, passage: proposal.passage } }
  }
}
