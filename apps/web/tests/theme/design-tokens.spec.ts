import { afterEach, describe, expect, it, vi } from 'vitest'
import { readionDesignTokens } from '~/design/tokens'

describe('Readion design tokens', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('maps DESIGN.md colors and typography into app tokens', () => {
    expect(readionDesignTokens.colors.primary.default).toBe('#1d4ed8')
    expect(readionDesignTokens.typography.sans).toEqual(['Inter', 'ui-sans-serif', 'system-ui'])
    expect(readionDesignTokens.colors.background).toEqual({
      base: '#0f172a',
      surface: '#1e293b',
      elevated: '#0a0f1e',
      overlay: '#16213e',
    })
    expect(readionDesignTokens.colors.status).toEqual({
      poor: '#f87171',
      warning: '#fb923c',
      medium: '#fbbf24',
      good: '#34d399',
    })
  })

  it('maps the Nuxt UI primary color to the Readion palette', async () => {
    vi.stubGlobal('defineAppConfig', (config: unknown) => config)

    const { default: appConfig } = await import('../../app/app.config')

    expect(appConfig.ui.colors.primary).toBe('readion-primary')
    expect(readionDesignTokens.colors.primary.default).toBe('#1d4ed8')
  })
})
