import { Inject, Injectable } from '@nestjs/common'
import type { CertExtractionFields, CertExtractionResult, ExtractedField } from '@readion/shared'
import { isVerbatimPassage } from '@readion/shared'
import { LlmService } from '../../llm/llm.service'
import type { ScrapperClient } from '../../scrapper/scrapper.client'
import { SCRAPPER_CLIENT } from '../../scrapper/scrapper.module'
import type { CertExtractionJobData, FieldProposal } from './cert-extraction.types'

@Injectable()
export class CertExtractionService {
  constructor(
    @Inject(SCRAPPER_CLIENT) private readonly scrapper: ScrapperClient,
    private readonly llm: LlmService,
  ) {}

  async extract(data: CertExtractionJobData): Promise<CertExtractionResult> {
    const { content } = await this.scrapper.fetch(data.confirmedSourceUrl)
    const proposals = await this.llm.extractCertFields(content, {
      name: data.name,
      code: data.code,
    })

    const ground = <T>(proposal: FieldProposal<T> | null): Promise<ExtractedField<T>> =>
      this.groundField(content, data.confirmedSourceUrl, proposal)

    const fields: CertExtractionFields = {
      domains: await ground(proposals.domains),
      questionCount: await ground(proposals.questionCount),
      passingScore: await ground(proposals.passingScore),
      timeLimitMinutes: await ground(proposals.timeLimitMinutes),
    }

    return { fields }
  }

  private async groundField<T>(
    sourceText: string,
    url: string,
    proposal: FieldProposal<T> | null,
  ): Promise<ExtractedField<T>> {
    if (proposal === null || !isVerbatimPassage(sourceText, proposal.passage)) {
      return { unverified: true }
    }

    const entailed = await this.llm.verifyFieldEntailment(proposal.value, proposal.passage)
    if (!entailed) {
      return { unverified: true }
    }

    return { value: proposal.value, citation: { url, passage: proposal.passage } }
  }
}
