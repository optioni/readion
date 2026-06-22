import { expect, test } from '@playwright/test'

test.describe('web foundation shell', () => {
  test('renders the default app shell with dark mode metadata', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    const response = await page.goto('/')
    expect(response?.status()).toBe(200)

    const banner = page.getByRole('banner')
    await expect(banner).toContainText('Readion')
    await expect(page.locator('html')).toHaveClass(/(^|\s)dark(\s|$)/)

    const shellContainer = page.getByTestId('shell-container')
    const containerBox = await shellContainer.boundingBox()
    expect(containerBox).not.toBeNull()
    expect(containerBox?.width).toBeLessThan(1440)

    await expect(page.locator('head link[rel="manifest"]')).toHaveCount(1)
    await expect(page.locator('head meta[name="theme-color"]')).toHaveCount(1)
    await expect(
      page.locator('head meta[name="viewport"][content="width=device-width, initial-scale=1"]'),
    ).toHaveCount(1)
  })

  test('serves an installable manifest', async ({ page }) => {
    const response = await page.request.get('/manifest.webmanifest')
    expect(response.ok()).toBe(true)

    const manifest = await response.json()
    expect(manifest).toMatchObject({
      name: expect.any(String),
      short_name: expect.any(String),
      display: 'standalone',
    })
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: '192x192' }),
        expect.objectContaining({ sizes: '512x512' }),
      ]),
    )
  })

  test('registers a service worker for installability', async ({ page }) => {
    await page.goto('/')

    await expect
      .poll(async () =>
        page.evaluate(async () => {
          if (!('serviceWorker' in navigator)) {
            return false
          }

          const registration = await navigator.serviceWorker.ready

          return Boolean(registration.active ?? registration.installing ?? registration.waiting)
        }),
      )
      .toBe(true)
  })

  test('persists the color-mode toggle across reloads', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('html')).toHaveClass(/(^|\s)dark(\s|$)/)
    await page.getByRole('button', { name: 'Switch to light mode' }).click()
    await expect(page.locator('html')).toHaveClass(/(^|\s)light(\s|$)/)

    await page.reload()

    await expect(page.locator('html')).toHaveClass(/(^|\s)light(\s|$)/)
    await expect(page.getByRole('button', { name: 'Switch to dark mode' })).toBeVisible()
  })

  test('does not overflow on a phone viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))

    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
  })
})
