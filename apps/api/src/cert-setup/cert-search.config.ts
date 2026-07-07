import type { ConfigService } from '@nestjs/config'
import { CERT_SEARCH_MAX_RESULTS_DEFAULT, type CertSearchProvider } from '@readion/shared'
import type { EnvConfig } from '../config/env.schema'

export interface SearchProviderConfig {
  provider: CertSearchProvider
  apiKey: string | undefined
  maxResults: number
}

// WHY: the search provider is optional everywhere, including production (see
// env.schema.ts) — an unprovisioned TAVILY_API_KEY is a valid, expected deploy
// state, not a misconfiguration. `apiKey` being undefined here is the signal
// the CertWebSearchAdapter (wired in a later group) uses to short-circuit to
// `[]` rather than call out to Tavily: discovery stays inert, never crashes,
// and never fabricates candidate URLs. That inert state gets surfaced via a
// log line / metric in the adapter, not here.
export function getSearchProviderConfig(config: ConfigService<EnvConfig>): SearchProviderConfig {
  return {
    provider: config.get('CERT_SEARCH_PROVIDER', { infer: true }) ?? 'tavily',
    apiKey: config.get('TAVILY_API_KEY', { infer: true }),
    maxResults:
      config.get('CERT_SEARCH_MAX_RESULTS', { infer: true }) ?? CERT_SEARCH_MAX_RESULTS_DEFAULT,
  }
}
