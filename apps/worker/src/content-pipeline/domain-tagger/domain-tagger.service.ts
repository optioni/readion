import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { DomainTag } from '@readion/shared'
import type { WorkerEnvConfig } from '../../config/env.schema'
import { LlmService } from '../../llm/llm.service'

export interface TagResult {
  tags: DomainTag[]
  primaryDomain: string | null
}

@Injectable()
export class DomainTaggerService {
  constructor(
    private readonly llm: LlmService,
    private readonly config: ConfigService<WorkerEnvConfig>,
  ) {}

  async tag(text: string, domains: string[]): Promise<TagResult> {
    const threshold = this.config.get('CONTENT_DOMAIN_CONFIDENCE_THRESHOLD') ?? 0.5
    const tags = await this.llm.tagDomains(text, domains, threshold)

    if (tags.length === 0) return { tags: [], primaryDomain: null }

    const sorted = [...tags].sort((a, b) => b.confidence - a.confidence)
    const primaryDomain = sorted[0]?.domain ?? null

    return { tags, primaryDomain }
  }
}
