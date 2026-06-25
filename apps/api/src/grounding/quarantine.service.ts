import { Injectable } from '@nestjs/common'
import type { Provenance } from '@readion/shared'
import { InjectMetric } from '@willsoto/nestjs-prometheus'
import type { Counter } from 'prom-client'
import { LlmResponseCacheService } from '../llm/llm-response-cache.service'
import { GROUNDING_QUARANTINED_ITEMS_METRIC } from './grounding.metrics'

export type QuarantineRecord = {
  readonly cacheKey: string
  readonly provenance: Provenance
  readonly reason: string
  readonly quarantinedAt: string
}

@Injectable()
export class QuarantineService {
  constructor(
    private readonly cache: LlmResponseCacheService,
    @InjectMetric(GROUNDING_QUARANTINED_ITEMS_METRIC)
    private readonly quarantinedItemsCounter: Counter,
  ) {}

  async quarantine(
    cacheKey: string,
    provenance: Provenance,
    reason: string,
    certificationId?: string,
  ): Promise<QuarantineRecord> {
    await this.cache.evict(cacheKey)

    const labels: Record<string, string> = {}
    if (certificationId) {
      labels.certification = certificationId
    }
    this.quarantinedItemsCounter.inc(labels)

    return Object.freeze({
      cacheKey,
      provenance,
      reason,
      quarantinedAt: new Date().toISOString(),
    })
  }
}
