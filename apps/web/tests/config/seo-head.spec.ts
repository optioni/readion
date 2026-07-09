import { describe, expect, it } from 'vitest'
import { buildTitle, SITE_DESCRIPTION } from '~/utils/seo'

describe('buildTitle', () => {
  it('composes a page-specific title with the site name', () => {
    expect(buildTitle('Sign in')).toBe('Sign in · Readion')
  })

  it('falls back to a default chunk when no page title is given', () => {
    const title = buildTitle()

    expect(title.length).toBeGreaterThan(0)
    expect(title).toMatch(/· Readion$/)
  })
})

describe('web SEO head config', () => {
  it('declares a title template, default title, and default meta description', async () => {
    process.env.NUXT_PUBLIC_API_BASE_URL = 'http://localhost:3001/api/v1'

    const { default: config } = await import('../../nuxt.config')
    const head = config.app?.head

    expect(head?.title).toBeTruthy()
    expect(typeof head?.titleTemplate).toBe('string')

    const resolvedDefault =
      typeof head?.titleTemplate === 'string' && typeof head.title === 'string'
        ? head.titleTemplate.replace('%s', head.title)
        : undefined
    expect(resolvedDefault).toMatch(/· Readion$/)

    const descriptionMeta = head?.meta?.find((m) => 'name' in m && m.name === 'description')
    expect(descriptionMeta?.content).toBe(SITE_DESCRIPTION)
    expect(descriptionMeta?.content.length).toBeGreaterThan(0)
  })

  it('still declares the manifest link, theme-color, and viewport meta', async () => {
    process.env.NUXT_PUBLIC_API_BASE_URL = 'http://localhost:3001/api/v1'

    const { default: config } = await import('../../nuxt.config')
    const head = config.app?.head

    expect(head?.link).toEqual(
      expect.arrayContaining([expect.objectContaining({ rel: 'manifest' })]),
    )
    expect(head?.meta).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'theme-color' }),
        expect.objectContaining({ name: 'viewport' }),
      ]),
    )
  })
})
