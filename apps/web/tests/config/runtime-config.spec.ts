import { describe, expect, it } from 'vitest'
import { resolvePublicApiBaseUrl, selectApiBaseUrl } from '~/config/api-base-url'

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

  describe('selectApiBaseUrl', () => {
    const config = {
      internalApiBaseUrl: 'http://readion-api.readion.svc.cluster.local',
      public: { apiBaseUrl: 'https://api.readion.app' },
    }

    it('uses the internal URL on the server when configured', () => {
      expect(selectApiBaseUrl(true, config)).toBe('http://readion-api.readion.svc.cluster.local')
    })

    it('uses the public URL in the browser', () => {
      expect(selectApiBaseUrl(false, config)).toBe('https://api.readion.app')
    })

    it('falls back to the public URL on the server when no internal URL is set', () => {
      expect(selectApiBaseUrl(true, { internalApiBaseUrl: '', public: config.public })).toBe(
        'https://api.readion.app',
      )
    })
  })
})
