import { describe, expect, it } from 'vitest'
import { resolvePublicApiBaseUrl } from '~/config/api-base-url'

describe('web runtime config', () => {
  it('exposes the API base URL from NUXT_PUBLIC_API_BASE_URL', async () => {
    process.env.NUXT_PUBLIC_API_BASE_URL = 'http://localhost:3001/api/v1'

    const { default: config } = await import('../../nuxt.config')

    expect(config.runtimeConfig?.public?.apiBaseUrl).toBe('http://localhost:3001/api/v1')
  })

  it('fails fast when the public API base URL is missing or invalid', () => {
    expect(() => resolvePublicApiBaseUrl({})).toThrow('NUXT_PUBLIC_API_BASE_URL is required')
    expect(() =>
      resolvePublicApiBaseUrl({ NUXT_PUBLIC_API_BASE_URL: 'localhost:3001/api/v1' }),
    ).toThrow('NUXT_PUBLIC_API_BASE_URL must be an HTTP(S) URL')
  })
})
