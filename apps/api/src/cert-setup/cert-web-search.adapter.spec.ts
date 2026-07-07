import { ConfigService } from '@nestjs/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EnvConfig } from '../config/env.schema'
import { CertWebSearchAdapter } from './cert-web-search.adapter'
import type { CertSearchHttpClient } from './tavily-search.client'

function configWith(overrides: Partial<EnvConfig>) {
  return new ConfigService<EnvConfig>(overrides as EnvConfig)
}

function fakeCounter() {
  return { inc: vi.fn() }
}

describe('CertWebSearchAdapter', () => {
  let client: CertSearchHttpClient
  let counter: ReturnType<typeof fakeCounter>

  beforeEach(() => {
    client = { search: vi.fn() }
    counter = fakeCounter()
  })

  it('maps provider results to CertSearchResult, flags official vendor hosts, and caps to maxResults', async () => {
    vi.mocked(client.search).mockResolvedValue([
      {
        title: 'AWS Certified Cloud Practitioner',
        url: 'https://aws.amazon.com/certification/',
        content: 'Official AWS exam guide',
      },
      { title: 'Exam dumps', url: 'https://examtopics.com/aws', content: 'Practice questions' },
      { title: 'Extra result', url: 'https://examtopics.com/extra', content: '' },
    ])
    const config = configWith({
      CERT_SEARCH_PROVIDER: 'tavily',
      TAVILY_API_KEY: 'tvly-test-key',
      CERT_SEARCH_MAX_RESULTS: 2,
    })
    // biome-ignore lint/suspicious/noExplicitAny: counter is a fake Prometheus Counter for this unit test
    const adapter = new CertWebSearchAdapter(client, config, counter as any)

    const results = await adapter.search('aws certified cloud practitioner')

    expect(results).toEqual([
      {
        url: 'https://aws.amazon.com/certification/',
        title: 'AWS Certified Cloud Practitioner',
        snippet: 'Official AWS exam guide',
        official: true,
      },
      {
        url: 'https://examtopics.com/aws',
        title: 'Exam dumps',
        snippet: 'Practice questions',
        official: false,
      },
    ])
    expect(client.search).toHaveBeenCalledWith('aws certified cloud practitioner', {
      apiKey: 'tvly-test-key',
      maxResults: 2,
    })
    expect(counter.inc).not.toHaveBeenCalled()
  })

  it('omits snippet when content is empty', async () => {
    vi.mocked(client.search).mockResolvedValue([
      { title: 'No content', url: 'https://kubernetes.io/docs', content: '' },
    ])
    const config = configWith({
      CERT_SEARCH_PROVIDER: 'tavily',
      TAVILY_API_KEY: 'tvly-test-key',
      CERT_SEARCH_MAX_RESULTS: 8,
    })
    // biome-ignore lint/suspicious/noExplicitAny: counter is a fake Prometheus Counter for this unit test
    const adapter = new CertWebSearchAdapter(client, config, counter as any)

    const results = await adapter.search('kubernetes')

    expect(results).toEqual([
      { url: 'https://kubernetes.io/docs', title: 'No content', official: true },
    ])
  })

  it('returns [] and increments the not_configured counter exactly once when TAVILY_API_KEY is unset', async () => {
    const config = configWith({
      CERT_SEARCH_PROVIDER: 'tavily',
      CERT_SEARCH_MAX_RESULTS: 8,
    })
    // biome-ignore lint/suspicious/noExplicitAny: counter is a fake Prometheus Counter for this unit test
    const adapter = new CertWebSearchAdapter(client, config, counter as any)

    const results = await adapter.search('aws certified cloud practitioner')

    expect(results).toEqual([])
    expect(client.search).not.toHaveBeenCalled()
    expect(counter.inc).toHaveBeenCalledTimes(1)
    expect(counter.inc).toHaveBeenCalledWith({ reason: 'not_configured' })
  })

  it('returns [] and increments the error counter exactly once when the provider call rejects', async () => {
    vi.mocked(client.search).mockRejectedValue(new Error('tavily 500'))
    const config = configWith({
      CERT_SEARCH_PROVIDER: 'tavily',
      TAVILY_API_KEY: 'tvly-test-key',
      CERT_SEARCH_MAX_RESULTS: 8,
    })
    // biome-ignore lint/suspicious/noExplicitAny: counter is a fake Prometheus Counter for this unit test
    const adapter = new CertWebSearchAdapter(client, config, counter as any)

    const results = await adapter.search('aws certified cloud practitioner')

    expect(results).toEqual([])
    expect(counter.inc).toHaveBeenCalledTimes(1)
    expect(counter.inc).toHaveBeenCalledWith({ reason: 'error' })
  })

  it('returns [] and increments the error counter exactly once when the provider call times out', async () => {
    vi.mocked(client.search).mockRejectedValue(
      new DOMException('The operation was aborted', 'TimeoutError'),
    )
    const config = configWith({
      CERT_SEARCH_PROVIDER: 'tavily',
      TAVILY_API_KEY: 'tvly-test-key',
      CERT_SEARCH_MAX_RESULTS: 8,
    })
    // biome-ignore lint/suspicious/noExplicitAny: counter is a fake Prometheus Counter for this unit test
    const adapter = new CertWebSearchAdapter(client, config, counter as any)

    const results = await adapter.search('aws certified cloud practitioner')

    expect(results).toEqual([])
    expect(counter.inc).toHaveBeenCalledTimes(1)
    expect(counter.inc).toHaveBeenCalledWith({ reason: 'error' })
  })
})
