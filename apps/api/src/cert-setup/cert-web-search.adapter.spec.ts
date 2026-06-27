import { describe, expect, it } from 'vitest'
import { CertWebSearchAdapter } from './cert-web-search.adapter'

describe('CertWebSearchAdapter', () => {
  it('returns no results from the placeholder backend', async () => {
    const adapter = new CertWebSearchAdapter()

    await expect(adapter.search('aws certified cloud practitioner')).resolves.toEqual([])
  })
})
