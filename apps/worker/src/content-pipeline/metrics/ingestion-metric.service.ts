import { Injectable } from '@nestjs/common'
import type { ContentSourceType } from '@readion/shared'
import { Counter, register } from 'prom-client'

const METRIC_NAME = 'content_chunks_ingested_total'

@Injectable()
export class IngestionMetricService {
  private readonly counter: Counter

  constructor() {
    const existing = register.getSingleMetric(METRIC_NAME)
    if (existing) {
      this.counter = existing as Counter
    } else {
      this.counter = new Counter({
        name: METRIC_NAME,
        help: 'Total number of content chunks ingested, by source type',
        labelNames: ['type'],
      })
    }
  }

  increment(sourceType: ContentSourceType, count: number): void {
    this.counter.inc({ type: sourceType }, count)
  }
}
