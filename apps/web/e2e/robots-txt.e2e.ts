import { expect, test } from '@playwright/test'
import { PUBLIC_AUTH_ROUTES } from '../app/constants/publicRoutes'

test.describe('robots.txt — crawler directives', () => {
  test('is served as text/plain with a blanket disallow and public-route allows', async ({
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
  })
})
