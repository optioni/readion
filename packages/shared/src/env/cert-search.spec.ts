import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { certSearchEnvFragment } from './cert-search'

const schema = z.object({ ...certSearchEnvFragment })

function parse(env: Record<string, string | undefined> = {}) {
  const result = schema.safeParse(env)
  if (!result.success) {
    const fields = result.error.issues.map((i) => i.path.join('.')).join(', ')
    throw new Error(`Invalid: ${fields}`)
  }
  return result.data
}

describe('certSearchEnvFragment', () => {
  it('parses CERT_SEARCH_PROVIDER, TAVILY_API_KEY, and CERT_SEARCH_MAX_RESULTS when present', () => {
    const result = parse({
      CERT_SEARCH_PROVIDER: 'tavily',
      TAVILY_API_KEY: 'tvly-test-key',
      CERT_SEARCH_MAX_RESULTS: '5',
    })
    expect(result.CERT_SEARCH_PROVIDER).toBe('tavily')
    expect(result.TAVILY_API_KEY).toBe('tvly-test-key')
    expect(result.CERT_SEARCH_MAX_RESULTS).toBe(5)
  })

  it('defaults CERT_SEARCH_PROVIDER to tavily and CERT_SEARCH_MAX_RESULTS to 8 when omitted', () => {
    const result = parse()
    expect(result.CERT_SEARCH_PROVIDER).toBe('tavily')
    expect(result.CERT_SEARCH_MAX_RESULTS).toBe(8)
  })

  it('leaves TAVILY_API_KEY undefined when omitted — discovery stays inert but healthy', () => {
    const result = parse()
    expect(result.TAVILY_API_KEY).toBeUndefined()
  })

  it('treats a blank TAVILY_API_KEY as undefined — the shipped inert default must not error', () => {
    const result = parse({ TAVILY_API_KEY: '' })
    expect(result.TAVILY_API_KEY).toBeUndefined()
  })

  it('rejects an unsupported CERT_SEARCH_PROVIDER naming the var', () => {
    expect(() => parse({ CERT_SEARCH_PROVIDER: 'bing' })).toThrow(/CERT_SEARCH_PROVIDER/)
  })

  it('rejects a non-positive CERT_SEARCH_MAX_RESULTS naming the var', () => {
    expect(() => parse({ CERT_SEARCH_MAX_RESULTS: '0' })).toThrow(/CERT_SEARCH_MAX_RESULTS/)
  })
})
