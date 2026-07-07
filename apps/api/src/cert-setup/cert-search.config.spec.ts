import { ConfigService } from '@nestjs/config'
import { describe, expect, it } from 'vitest'
import type { EnvConfig } from '../config/env.schema'
import { getSearchProviderConfig } from './cert-search.config'

function configWith(overrides: Partial<EnvConfig>) {
  return new ConfigService<EnvConfig>(overrides as EnvConfig)
}

describe('getSearchProviderConfig', () => {
  it('returns the API key and defaulted provider/maxResults when TAVILY_API_KEY is set', () => {
    const config = configWith({
      CERT_SEARCH_PROVIDER: 'tavily',
      TAVILY_API_KEY: 'tvly-test-key',
      CERT_SEARCH_MAX_RESULTS: 8,
    })

    const result = getSearchProviderConfig(config)

    expect(result.provider).toBe('tavily')
    expect(result.apiKey).toBe('tvly-test-key')
    expect(result.maxResults).toBe(8)
  })

  it('leaves apiKey undefined while provider/maxResults still resolve to defaults when unset', () => {
    const config = configWith({
      CERT_SEARCH_PROVIDER: 'tavily',
      CERT_SEARCH_MAX_RESULTS: 8,
    })

    const result = getSearchProviderConfig(config)

    expect(result.apiKey).toBeUndefined()
    expect(result.provider).toBe('tavily')
    expect(result.maxResults).toBe(8)
  })
})
