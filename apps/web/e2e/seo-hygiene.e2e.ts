import { expect, test } from '@playwright/test'
import { PUBLIC_AUTH_ROUTES } from '../app/constants/publicRoutes'

const DISALLOWED_APP_ROUTES = ['/agent', '/onboarding']

test.describe('seo-hygiene — defensive crawler exclusion', () => {
  test('GET /robots.txt disallows the whole app, allows the public auth routes', async ({
    request,
  }) => {
    const response = await request.get('/robots.txt')

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('text/plain')

    const body = await response.text()

    expect(body).toMatch(/User-agent:\s*\*/)
    expect(body).toMatch(/Disallow:\s*\/\s*$/m)

    for (const route of PUBLIC_AUTH_ROUTES) {
      expect(body).toMatch(new RegExp(`Allow:\\s*${route}\\s*$`, 'm'))
    }

    for (const route of DISALLOWED_APP_ROUTES) {
      expect(body).not.toMatch(new RegExp(`Allow:\\s*${route}\\s*$`, 'm'))
    }
  })
})

test.describe('seo-hygiene — global title and social share metadata', () => {
  for (const route of ['/login', '/register']) {
    test(`${route} renders a titled, described, and shareable document head`, async ({
      page,
    }) => {
      await page.goto(route)
      await page.waitForLoadState('networkidle')

      const title = await page.title()
      expect(title.length).toBeGreaterThan(0)
      expect(title).toMatch(/· Readion$/)

      const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content')
      const ogDescription = await page
        .locator('meta[property="og:description"]')
        .getAttribute('content')
      const twitterCard = await page.locator('meta[name="twitter:card"]').getAttribute('content')

      expect(ogTitle?.length ?? 0).toBeGreaterThan(0)
      expect(ogDescription?.length ?? 0).toBeGreaterThan(0)
      expect(twitterCard?.length ?? 0).toBeGreaterThan(0)
    })
  }
})
