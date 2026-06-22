import type { ModuleOptions } from '@vite-pwa/nuxt'
import { describe, expect, it } from 'vitest'

type ManifestRecord = Record<string, unknown>

describe('PWA config', () => {
  it('declares an installable manifest without offline runtime caching', async () => {
    process.env.NUXT_PUBLIC_API_BASE_URL = 'http://localhost:3001/api/v1'

    const { default: config } = await import('../../nuxt.config')
    const pwa = config.pwa as Partial<ModuleOptions>
    const manifest = pwa.manifest as ManifestRecord

    expect(manifest).toMatchObject({
      name: 'Readion',
      short_name: 'Readion',
      display: 'standalone',
      start_url: '/',
      theme_color: '#0f172a',
      background_color: '#0f172a',
    })
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: '192x192' }),
        expect.objectContaining({ sizes: '512x512' }),
      ]),
    )
    expect(pwa.strategies).toBe('injectManifest')
    expect(pwa.includeManifestIcons).toBe(false)
    expect(pwa.injectManifest?.globPatterns).toEqual([])
    expect(pwa.injectManifest?.injectionPoint).toBeUndefined()
    expect(pwa.injectManifest?.manifestTransforms).toHaveLength(1)
  })
})
