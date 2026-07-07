import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { CERT_VENDOR_DOMAINS, isVendorHost } from '@readion/shared'
import { InjectMetric } from '@willsoto/nestjs-prometheus'
import type { Counter } from 'prom-client'
import type { EnvConfig } from '../config/env.schema'
import type { CertSearchPort, CertSearchResult } from './cert-discovery.types'
import { getSearchProviderConfig } from './cert-search.config'
import { CERT_SEARCH_UNAVAILABLE_METRIC } from './cert-search.metrics'
import {
  CERT_SEARCH_HTTP_CLIENT,
  type CertSearchHttpClient,
  type TavilyResult,
} from './tavily-search.client'

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return ''
  }
}

function mapResult(result: TavilyResult): CertSearchResult {
  const official = isVendorHost(hostOf(result.url), CERT_VENDOR_DOMAINS)
  return result.content.length > 0
    ? { url: result.url, title: result.title, snippet: result.content, official }
    : { url: result.url, title: result.title, official }
}

// Backed by Tavily: unconfigured (no TAVILY_API_KEY) or a failed/timed-out
// call both degrade to `[]` so discovery stays a deterministic 200 rather
// than surfacing a 5xx or fabricating candidate URLs. Both degraded paths
// are also observable via the counter/log below, distinguishing "not wired"
// from "found nothing".
@Injectable()
export class CertWebSearchAdapter implements CertSearchPort {
  private readonly logger = new Logger(CertWebSearchAdapter.name)

  constructor(
    @Inject(CERT_SEARCH_HTTP_CLIENT) private readonly client: CertSearchHttpClient,
    private readonly config: ConfigService<EnvConfig>,
    @InjectMetric(CERT_SEARCH_UNAVAILABLE_METRIC) private readonly unavailableCounter: Counter,
  ) {}

  async search(query: string): Promise<CertSearchResult[]> {
    const { apiKey, maxResults } = getSearchProviderConfig(this.config)

    if (apiKey === undefined) {
      this.unavailableCounter.inc({ reason: 'not_configured' })
      this.logger.warn('Cert source discovery search skipped: TAVILY_API_KEY is not configured')
      return []
    }

    try {
      const results = await this.client.search(query, { apiKey, maxResults })
      return results.map(mapResult).slice(0, maxResults)
    } catch (error) {
      this.unavailableCounter.inc({ reason: 'error' })
      this.logger.warn('Cert source discovery search failed', error)
      return []
    }
  }
}
