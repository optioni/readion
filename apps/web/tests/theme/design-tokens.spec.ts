import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readionDesignTokens } from '~/design/tokens'

const stylesheet = readFileSync(resolve(process.cwd(), 'app/assets/css/main.css'), 'utf8')

function relativeLuminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))

  if (channels?.length !== 3) {
    throw new Error(`Invalid color: ${hex}`)
  }

  const [red, green, blue] = channels as [number, number, number]
  return red * 0.2126 + green * 0.7152 + blue * 0.0722
}

function contrastRatio(first: string, second: string) {
  const firstLuminance = relativeLuminance(first)
  const secondLuminance = relativeLuminance(second)
  const lighter = Math.max(firstLuminance, secondLuminance)
  const darker = Math.min(firstLuminance, secondLuminance)
  return (lighter + 0.05) / (darker + 0.05)
}

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

  it.each([
    'dark',
    'light',
  ] as const)('defines every semantic token required by controls in %s mode', (mode) => {
    const colors = readionDesignTokens.modes[mode]

    expect(colors).toMatchObject({
      background: {
        base: expect.stringMatching(/^#[\da-f]{6}$/i),
        surface: expect.stringMatching(/^#[\da-f]{6}$/i),
        elevated: expect.stringMatching(/^#[\da-f]{6}$/i),
        overlay: expect.stringMatching(/^#[\da-f]{6}$/i),
      },
      text: {
        primary: expect.stringMatching(/^#[\da-f]{6}$/i),
        secondary: expect.stringMatching(/^#[\da-f]{6}$/i),
        muted: expect.stringMatching(/^#[\da-f]{6}$/i),
        subtle: expect.stringMatching(/^#[\da-f]{6}$/i),
        onPrimary: expect.stringMatching(/^#[\da-f]{6}$/i),
      },
      border: {
        default: expect.stringMatching(/^#[\da-f]{6}$/i),
        strong: expect.stringMatching(/^#[\da-f]{6}$/i),
      },
      status: {
        poor: expect.stringMatching(/^#[\da-f]{6}$/i),
        warning: expect.stringMatching(/^#[\da-f]{6}$/i),
        medium: expect.stringMatching(/^#[\da-f]{6}$/i),
        good: expect.stringMatching(/^#[\da-f]{6}$/i),
      },
      focus: expect.stringMatching(/^#[\da-f]{6}$/i),
      warning: expect.stringMatching(/^#[\da-f]{6}$/i),
      destructive: {
        default: expect.stringMatching(/^#[\da-f]{6}$/i),
        hover: expect.stringMatching(/^#[\da-f]{6}$/i),
        active: expect.stringMatching(/^#[\da-f]{6}$/i),
      },
    })
  })

  it.each([
    'dark',
    'light',
  ] as const)('meets label and focus contrast thresholds in %s mode', (mode) => {
    const colors = readionDesignTokens.modes[mode]

    expect(contrastRatio(colors.text.onPrimary, colors.primary.default)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(colors.text.primary, colors.background.surface)).toBeGreaterThanOrEqual(
      4.5,
    )
    expect(contrastRatio(colors.text.onPrimary, colors.destructive.default)).toBeGreaterThanOrEqual(
      4.5,
    )
    expect(contrastRatio(colors.text.primary, colors.border.strong)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(colors.text.secondary, colors.background.surface)).toBeGreaterThanOrEqual(
      4.5,
    )
    expect(contrastRatio(colors.focus, colors.background.base)).toBeGreaterThanOrEqual(3)
  })

  it('maps shared Tailwind aliases to mode-specific semantic variables', () => {
    for (const token of ['surface', 'border-default', 'warning', 'focus']) {
      expect(stylesheet).toContain(`--color-readion-${token}: var(--readion-${token});`)
      expect(stylesheet.match(new RegExp(`--readion-${token}:`, 'g'))).toHaveLength(2)
    }

    expect(stylesheet).toContain('html.light {')
    expect(stylesheet).toContain('color-scheme: light;')
  })

  it('removes non-essential shared-control motion for reduced-motion users', () => {
    expect(stylesheet).toContain('@media (prefers-reduced-motion: reduce)')
    expect(stylesheet).toContain('.readion-interactive-control')
    expect(stylesheet).toContain('transition-duration: 0ms;')
    expect(stylesheet).toContain('transform: none;')
  })
})
