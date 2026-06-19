import { expect, test } from '@playwright/test'

test('web serves a placeholder page', async ({ page }) => {
  const response = await page.goto('/')
  expect(response?.status()).toBe(200)
  const content = await page.content()
  expect(content).toContain('<html')
})
