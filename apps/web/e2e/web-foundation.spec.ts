import { expect, test } from '@playwright/test'
import { gotoAuthenticated } from './support/session-view-seed'
import { mockSettings } from './support/settings-seed'

// The shell contract (dark default, persistent left sidebar, relocated color-mode toggle, no phone
// overflow) is asserted against an AUTHENTICATED in-shell page: the default layout only renders for
// signed-in routes, and `auth.global` bounces anonymous traffic on `/` to `/login` (the bare auth
// layout, which has no sidebar/toggle). The settings route is mocked end-to-end and reached via the
// shared `gotoAuthenticated` harness so the genuine shell chrome is exercised. The manifest +
// service-worker checks stay environment-level (app-wide, route-independent).

test.describe('web foundation shell', () => {
  test('renders the default app shell with dark mode metadata', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    mockSettings(page)

    await gotoAuthenticated(page, '/settings')
    await expect(page.getByTestId('settings-page')).toBeVisible()

    const sidebar = page.getByTestId('app-sidebar')
    await expect(sidebar).toBeVisible()
    await expect(sidebar.getByText('Readion')).toBeVisible()
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
    mockSettings(page)

    await gotoAuthenticated(page, '/settings')
    await expect(page.getByTestId('settings-page')).toBeVisible()

    await expect(page.locator('html')).toHaveClass(/(^|\s)dark(\s|$)/)
    await page.getByRole('button', { name: 'Switch to light mode' }).click()
    await expect(page.locator('html')).toHaveClass(/(^|\s)light(\s|$)/)

    // `gotoAuthenticated` performs a real full-page load of the origin before navigating back into
    // the shell, so the localStorage-backed preference is genuinely tested across a reload.
    await gotoAuthenticated(page, '/settings')
    await expect(page.getByTestId('settings-page')).toBeVisible()

    await expect(page.locator('html')).toHaveClass(/(^|\s)light(\s|$)/)
    await expect(page.getByRole('button', { name: 'Switch to dark mode' })).toBeVisible()
  })

  test('does not overflow on a phone viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    mockSettings(page)

    await gotoAuthenticated(page, '/settings')
    await expect(page.getByTestId('settings-page')).toBeVisible()

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))

    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
  })
})
